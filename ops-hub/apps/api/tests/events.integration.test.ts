import { randomUUID } from "node:crypto";

import { OutboxDispatcher } from "@ops-hub/events/dispatcher";
import { withIdempotency } from "@ops-hub/events/idempotent-consumer";
import PgBoss from "pg-boss";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CatalogService } from "../src/catalog/service";
import { PgProductStore, PgVariantStore } from "../src/catalog/pg-store";
import { PgBossQueueSender } from "../src/events/pg-boss-queue";
import { PgOutboxStore } from "../src/events/pg-outbox-store";
import { PgProcessedEventStore } from "../src/events/pg-processed-event-store";
import { DOMAIN_EVENTS_QUEUE, type DomainEventJob } from "../src/events/worker";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000000901";
// Unique per run: a leftover job from a prior crashed/killed run must never
// be mistaken for (or interfere with) this run's delivery.
const queueName = `test-${DOMAIN_EVENTS_QUEUE}-${randomUUID()}`;

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });

describe.skipIf(!runDbTests)(
  "Outbox and event dispatcher against Postgres",
  () => {
    beforeAll(async () => {
      await client.connect();
      await client.query("delete from outbox_events where tenant_id = $1", [
        tenantA,
      ]);
      await client.query("delete from processed_events where tenant_id = $1", [
        tenantA,
      ]);
      await client.query("delete from variants where tenant_id = $1", [
        tenantA,
      ]);
      await client.query("delete from products where tenant_id = $1", [
        tenantA,
      ]);
      await client.query("delete from tenants where id = $1", [tenantA]);
      await client.query(
        "insert into tenants (id, slug, name) values ($1, 'events-a', 'Events Tenant A')",
        [tenantA],
      );
    });

    afterAll(async () => {
      await client.query("delete from outbox_events where tenant_id = $1", [
        tenantA,
      ]);
      await client.query("delete from processed_events where tenant_id = $1", [
        tenantA,
      ]);
      await client.query("delete from variants where tenant_id = $1", [
        tenantA,
      ]);
      await client.query("delete from products where tenant_id = $1", [
        tenantA,
      ]);
      await client.query("delete from tenants where id = $1", [tenantA]);
      await client.end();
      await pool.end();
    });

    it("writes the outbox row in the same transaction as the domain change", async () => {
      const catalog = new CatalogService({
        products: new PgProductStore(pool),
        variants: new PgVariantStore(pool),
        clock: { now: () => new Date() },
      });

      const product = await catalog.createProduct(
        { nameEn: "Outbox Product", nameAr: "منتج" },
        tenantA,
      );

      const rows = await client.query<{
        event_type: string;
        payload: { id: string };
      }>(
        `select event_type, payload from outbox_events where tenant_id = $1 and payload->>'id' = $2`,
        [tenantA, product.id],
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]?.event_type).toBe("product.created");
      expect(rows.rows[0]?.payload.id).toBe(product.id);
    });

    it("PgProcessedEventStore marks an event processed only once per consumer", async () => {
      const store = new PgProcessedEventStore(pool);
      const eventId = randomUUID();

      const first = await store.tryMarkProcessed(
        tenantA,
        "consumer-x",
        eventId,
      );
      const second = await store.tryMarkProcessed(
        tenantA,
        "consumer-x",
        eventId,
      );
      const differentConsumer = await store.tryMarkProcessed(
        tenantA,
        "consumer-y",
        eventId,
      );

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(differentConsumer).toBe(true);
    });

    it("end to end: an outbox event reaches a real pg-boss queue and the idempotent consumer runs once even on redelivery", async () => {
      const outboxStore = new PgOutboxStore(pool);
      const processedStore = new PgProcessedEventStore(pool);
      const boss = new PgBoss(databaseUrl);
      await boss.start();
      await boss.createQueue(queueName);

      try {
        const catalog = new CatalogService({
          products: new PgProductStore(pool),
          variants: new PgVariantStore(pool),
          clock: { now: () => new Date() },
        });
        const product = await catalog.createProduct(
          { nameEn: "E2E Outbox Product", nameAr: "منتج" },
          tenantA,
        );

        const dispatcher = new OutboxDispatcher(
          outboxStore,
          new PgBossQueueSender(boss),
          queueName,
        );
        const result = await dispatcher.publishPending();
        expect(result.sent).toBeGreaterThanOrEqual(1);

        // Pull directly via boss.fetch() rather than boss.work()'s
        // background polling loop: this makes retrieval deterministic
        // instead of racing pg-boss's own poll interval, which (correctly)
        // isn't this test's concern — it only needs to prove the event
        // really reached a real queue.
        let fetched: DomainEventJob | undefined;
        for (let attempt = 0; attempt < 20 && !fetched; attempt += 1) {
          const jobs = await boss.fetch<DomainEventJob>(queueName, {
            batchSize: 10,
          });
          fetched = jobs.find(
            (job) =>
              (job.data.payload as { id?: string } | null)?.id === product.id,
          )?.data;
          if (fetched) {
            await boss.complete(
              queueName,
              jobs.map((job) => job.id),
            );
          } else if (jobs.length === 0) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
        expect(fetched).toBeDefined();
        expect(fetched?.eventType).toBe("product.created");

        let calls = 0;
        const handler = withIdempotency(
          "e2e-test-consumer",
          processedStore,
          async () => {
            calls += 1;
          },
        );

        // At-least-once delivery means a consumer may see the same event
        // more than once; the DB-backed idempotency store (not a fake)
        // must still only run the handler the first time.
        await handler(fetched!);
        await handler(fetched!);
        await handler(fetched!);

        expect(calls).toBe(1);
      } finally {
        await boss.deleteQueue(queueName).catch(() => undefined);
        await boss.stop({ graceful: false });
      }
    }, 20_000);
  },
);
