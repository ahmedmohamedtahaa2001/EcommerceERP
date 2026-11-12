import http from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  backoffSeconds,
  MAX_DELIVERY_ATTEMPTS,
  OutboundWebhookService,
  signPayload,
} from "../src/webhooks/outbound-service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantId = "00000000-0000-4000-8000-000000001401";
const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });

let server: http.Server;
let baseUrl: string;
const received: { body: string; signature: string | undefined }[] = [];
let failNext = 0;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      received.push({
        body,
        signature: req.headers["x-ops-hub-signature"] as string | undefined,
      });
      if (failNext > 0) {
        failNext--;
        res.statusCode = 500;
        res.end("boom");
        return;
      }
      res.statusCode = 200;
      res.end("ok");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;

  await client.connect();
  await client.query("delete from webhook_deliveries where tenant_id=$1", [
    tenantId,
  ]);
  await client.query("delete from webhook_subscriptions where tenant_id=$1", [
    tenantId,
  ]);
  await client.query("delete from tenants where id=$1", [tenantId]);
  await client.query(
    "insert into tenants (id, slug, name) values ($1,'webhooks-a','Webhooks Tenant')",
    [tenantId],
  );
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  await client.end();
});

describe.skipIf(!runDbTests)("Outbound webhooks against Postgres", () => {
  it("signs deliveries with HMAC-SHA256 the receiver can verify", async () => {
    const service = new OutboundWebhookService(pool);
    const sub = await service.createSubscription(tenantId, {
      name: "storefront",
      url: `${baseUrl}/hook`,
      events: ["order.created"],
      secret: "shared-secret",
    });
    expect(sub.secret).toBe("shared-secret");

    const queued = await service.enqueue(
      tenantId,
      "order.created",
      randomUUID(),
      {
        id: "order-1",
      },
    );
    expect(queued).toBe(1);

    const deliveries = await service.listDeliveries(tenantId);
    expect(deliveries).toHaveLength(1);

    const result = await service.deliver(tenantId, deliveries[0]!.id);
    expect(result.status).toBe("delivered");
    expect(result.attempts).toBe(1);

    expect(received).toHaveLength(1);
    const expected = signPayload("shared-secret", received[0]!.body);
    expect(received[0]!.signature).toBe(expected);
  });

  it("retries a failed delivery with exponential backoff, then marks it failed", async () => {
    const service = new OutboundWebhookService(pool);
    const sub = await service.createSubscription(tenantId, {
      name: "flaky",
      url: `${baseUrl}/flaky`,
      events: ["order.shipped"],
      secret: "s",
    });
    expect(sub.id).toBeTruthy();

    await service.enqueue(tenantId, "order.shipped", randomUUID(), { id: "x" });
    const deliveries = await service.listDeliveries(tenantId, {
      subscriptionId: sub.id,
    });
    const id = deliveries[0]!.id;

    failNext = MAX_DELIVERY_ATTEMPTS;
    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
      const result = await service.deliver(tenantId, id);
      expect(result.attempts).toBe(attempt);
      if (attempt < MAX_DELIVERY_ATTEMPTS) {
        expect(result.status).toBe("pending");
        expect(result.nextAttemptAt).not.toBeNull();
      } else {
        expect(result.status).toBe("failed");
        expect(result.nextAttemptAt).toBeNull();
      }
    }
  });

  it("replays a failed delivery successfully after the target recovers", async () => {
    const service = new OutboundWebhookService(pool);
    const sub = await service.createSubscription(tenantId, {
      name: "replay",
      url: `${baseUrl}/replay`,
      events: ["order.cancelled"],
      secret: "s",
    });
    await service.enqueue(tenantId, "order.cancelled", randomUUID(), {
      id: "y",
    });
    const deliveries = await service.listDeliveries(tenantId, {
      subscriptionId: sub.id,
    });
    const id = deliveries[0]!.id;

    failNext = 1;
    const failed = await service.deliver(tenantId, id);
    expect(failed.status).toBe("pending");
    expect(failed.attempts).toBe(1);

    const replayed = await service.replay(tenantId, id);
    expect(replayed.status).toBe("delivered");
    expect(replayed.attempts).toBe(2);
  });

  it("does not deliver to subscriptions that did not subscribe to the event", async () => {
    const service = new OutboundWebhookService(pool);
    await service.createSubscription(tenantId, {
      name: "other",
      url: `${baseUrl}/other`,
      events: ["refund.created"],
      secret: "s",
    });
    const before = received.length;
    const queued = await service.enqueue(
      tenantId,
      "product.updated",
      randomUUID(),
      { id: "z" },
    );
    expect(queued).toBe(0);
    expect(received.length).toBe(before);
  });
});

describe("backoff schedule", () => {
  it("increases and caps at the final delay", () => {
    expect(backoffSeconds(1)).toBe(60);
    expect(backoffSeconds(2)).toBe(300);
    expect(backoffSeconds(3)).toBe(900);
    expect(backoffSeconds(4)).toBe(2700);
    expect(backoffSeconds(5)).toBe(10800);
    expect(backoffSeconds(99)).toBe(10800);
  });
});
