import { randomUUID } from "node:crypto";

import { Client, Pool } from "pg";

import { argon2Hasher } from "../src/auth/passwords";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Redis from "ioredis";

import { buildFullApp } from "../src/wiring";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";
const tenantId = "00000000-0000-4000-8000-000000006401";
const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });

/** Every GET route that answers a list. */
const LIST_ROUTES = [
  "/v1/products",
  "/v1/exceptions",
  "/v1/orders",
  "/v1/tickets",
  "/v1/api-keys",
  "/v1/audit",
  "/v1/inventory/movements",
  "/v1/inventory/balances",
  "/v1/locations",
  "/v1/shipments",
  "/v1/suppliers",
  "/v1/purchase-orders",
  "/v1/connectors",
  "/v1/webhook-deliveries",
  "/v1/webhook-subscriptions",
  "/v1/dlq",
  "/v1/cod-tasks",
];

describe.skipIf(!runDbTests)(
  "List-route pagination contract (P4-S13-T03)",
  () => {
    let app: Awaited<ReturnType<typeof buildFullApp>>;
    let token: string;
    let redis: Redis;

    beforeAll(async () => {
      await client.connect();
      await client.query("delete from api_keys where tenant_id=$1", [tenantId]);
      await client.query("delete from audit_log where tenant_id=$1", [
        tenantId,
      ]);
      await client.query("delete from tenants where id=$1", [tenantId]);
      await client.query(
        "insert into tenants (id, slug, name) values ($1,'list-a','List Tenant')",
        [tenantId],
      );

      redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
        maxRetriesPerRequest: 1,
      });
      app = buildFullApp(pool, redis, { logger: false });
      await app.ready();

      const password = await argon2Hasher.hash("correct-horse");
      await client.query(
        `delete from memberships where user_id in
         (select id from users where email='list-owner@test.local')`,
      );
      await client.query(
        `delete from users where email='list-owner@test.local'`,
      );
      await client.query(
        `insert into users (id, email, password_hash, full_name)
       values ($1,$2,$3,'List Owner')`,
        [randomUUID(), "list-owner@test.local", password],
      );
      const user = await client.query<{ id: string }>(
        `select id from users where email='list-owner@test.local'`,
      );
      await client.query(
        `insert into memberships (id, tenant_id, user_id, role)
       values ($1,$2,$3,'owner')
       on conflict do nothing`,
        [randomUUID(), tenantId, user.rows[0]!.id],
      );

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: "list-owner@test.local", password: "correct-horse" },
      });
      token = response.json<{ token: string }>().token;
    });

    afterAll(async () => {
      await app.close();
      await pool.end();
      await client.end();
      redis.disconnect();
    });

    it("rejects an invalid cursor with 400 on every list route", async () => {
      for (const route of LIST_ROUTES) {
        const response = await app.inject({
          method: "GET",
          url: `${route}?cursor=not-a-cursor`,
          headers: { authorization: `Bearer ${token}` },
        });
        expect(
          response.statusCode,
          `${route} should reject an invalid cursor`,
        ).toBe(400);
      }
    });

    it("answers every list route with limit and nextCursor", async () => {
      for (const route of LIST_ROUTES) {
        const response = await app.inject({
          method: "GET",
          url: `${route}?limit=5`,
          headers: { authorization: `Bearer ${token}` },
        });
        expect(response.statusCode, `${route} should answer 200`).toBe(200);
        const body = response.json<Record<string, unknown>>();
        expect(body, `${route} should answer with nextCursor`).toHaveProperty(
          "nextCursor",
        );
      }
    });
  },
);

describe("Cursor helpers", () => {
  it("round-trips a cursor and rejects a broken one", async () => {
    const { encodeCursor, decodeCursor, readPagination } =
      await import("../src/platform/service");
    const cursor = { createdAt: "2026-02-01T00:00:00.000Z", id: randomUUID() };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor("broken")).toBeNull();
    expect(() => readPagination({ cursor: "broken" })).toThrow();
  });
});
