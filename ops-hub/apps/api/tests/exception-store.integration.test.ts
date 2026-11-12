import { randomUUID } from "node:crypto";

import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgExceptionStore } from "../src/orders/pg-exception-store";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000001401";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
let store: PgExceptionStore;
let orderId: string;
let userId: string;

async function cleanup() {
  await client.query("delete from exceptions where tenant_id = $1", [tenantA]);
  await client.query("delete from order_lines where tenant_id = $1", [tenantA]);
  await client.query("delete from payments where tenant_id = $1", [tenantA]);
  await client.query("delete from orders where tenant_id = $1", [tenantA]);
  await client.query("delete from order_number_counters where tenant_id = $1", [
    tenantA,
  ]);
  await client.query("delete from memberships where tenant_id = $1", [tenantA]);
  await client.query("delete from customers where tenant_id = $1", [tenantA]);
  await client.query("delete from users where email = $1", [
    "exc-store-owner@example.com",
  ]);
}

describe.skipIf(!runDbTests)("PgExceptionStore against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await cleanup();
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'exc-store-a', 'Exception Store A')",
      [tenantA],
    );
    const customerId = randomUUID();
    await client.query(
      `insert into customers (id, tenant_id, phone) values ($1, $2, '+201000000000')`,
      [customerId, tenantA],
    );
    orderId = randomUUID();
    await client.query(
      `insert into orders (id, tenant_id, order_number, customer_id, status, currency)
       values ($1, $2, 'OP-90001', $3, 'pending', 'EGP')`,
      [orderId, tenantA, customerId],
    );
    userId = randomUUID();
    await client.query(
      `insert into users (id, email, full_name) values ($1, 'exc-store-owner@example.com', 'Exc Owner')`,
      [userId],
    );
    store = new PgExceptionStore(pool);
  });

  afterAll(async () => {
    await cleanup();
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.end();
    await pool.end();
  });

  it("rejects an insert with no due_at at the database level", async () => {
    await expect(
      client.query(
        `insert into exceptions (tenant_id, order_id, reason_code) values ($1, $2, 'ADDRESS_INCOMPLETE')`,
        [tenantA, orderId],
      ),
    ).rejects.toThrow(/null value in column "due_at"/);
  });

  it("creates, lists, assigns, and resolves an exception", async () => {
    const dueAt = new Date(Date.now() + 60_000);
    const created = await store.create(
      tenantA,
      orderId,
      "ADDRESS_INCOMPLETE",
      dueAt,
      {
        note: "test",
      },
    );
    expect(created.status).toBe("open");
    expect(created.dueAt.getTime()).toBe(dueAt.getTime());

    const listed = await store.list(tenantA, { status: "open" });
    expect(listed.map((e) => e.id)).toContain(created.id);

    const assigned = await store.assign(tenantA, created.id, userId);
    expect(assigned?.ownerId).toBe(userId);

    const resolved = await store.resolve(tenantA, created.id, "fixed manually");
    expect(resolved).toBe(true);

    const refetched = await store.getById(tenantA, created.id);
    expect(refetched?.status).toBe("resolved");
    expect(refetched?.resolution).toBe("fixed manually");

    // Resolving again is a no-op, not an error.
    const resolvedAgain = await store.resolve(
      tenantA,
      created.id,
      "fixed again",
    );
    expect(resolvedAgain).toBe(false);
  });

  it("claimOverdue only claims open, past-due, not-yet-notified exceptions, and writes an outbox event", async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);

    const overdueOne = await store.create(
      tenantA,
      orderId,
      "ADDRESS_INCOMPLETE",
      past,
    );
    await store.create(tenantA, orderId, "INVALID_PHONE", future); // not due yet
    const alreadyResolved = await store.create(
      tenantA,
      orderId,
      "PRODUCT_NOT_FOUND",
      past,
    );
    await store.resolve(tenantA, alreadyResolved.id, "handled");

    const claimed = await store.claimOverdue(tenantA, new Date());
    expect(claimed.map((e) => e.id)).toEqual([overdueOne.id]);
    expect(claimed[0]?.overdueNotifiedAt).not.toBeNull();

    // Running the sweep again claims nothing new.
    const claimedAgain = await store.claimOverdue(tenantA, new Date());
    expect(claimedAgain).toEqual([]);

    const outboxRow = await client.query<{ event_type: string }>(
      `select event_type from outbox_events
        where tenant_id = $1 and event_type = 'exception.overdue'
          and payload->>'id' = $2`,
      [tenantA, overdueOne.id],
    );
    expect(outboxRow.rows).toHaveLength(1);
  });
});
