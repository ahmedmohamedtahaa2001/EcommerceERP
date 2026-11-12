import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { allocateOrderNumber } from "../src/orders/order-number";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000001001";
const tenantB = "00000000-0000-4000-8000-000000001002";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });

describe.skipIf(!runDbTests)("allocateOrderNumber against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query(
      "delete from order_number_counters where tenant_id in ($1, $2)",
      [tenantA, tenantB],
    );
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'order-num-a', 'Order Number A'), ($2, 'order-num-b', 'Order Number B')",
      [tenantA, tenantB],
    );
  });

  afterAll(async () => {
    await client.query(
      "delete from order_number_counters where tenant_id in ($1, $2)",
      [tenantA, tenantB],
    );
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.end();
    await pool.end();
  });

  it("starts at OP-10001 and increments sequentially", async () => {
    const first = await pool.connect();
    try {
      await first.query("begin");
      const n1 = await allocateOrderNumber(first, tenantA);
      await first.query("commit");
      expect(n1).toBe("OP-10001");
    } finally {
      first.release();
    }

    const second = await pool.connect();
    try {
      await second.query("begin");
      const n2 = await allocateOrderNumber(second, tenantA);
      await second.query("commit");
      expect(n2).toBe("OP-10002");
    } finally {
      second.release();
    }
  });

  it("is a separate sequence per tenant", async () => {
    const client1 = await pool.connect();
    try {
      await client1.query("begin");
      const number = await allocateOrderNumber(client1, tenantB);
      await client1.query("commit");
      expect(number).toBe("OP-10001");
    } finally {
      client1.release();
    }
  });

  it("leaves no gap when the allocating transaction rolls back", async () => {
    const before = await pool.connect();
    let numberBeforeRollback: string;
    try {
      await before.query("begin");
      numberBeforeRollback = await allocateOrderNumber(before, tenantA);
      await before.query("rollback");
    } finally {
      before.release();
    }

    const after = await pool.connect();
    try {
      await after.query("begin");
      const numberAfterRollback = await allocateOrderNumber(after, tenantA);
      await after.query("commit");
      // The rolled-back allocation never happened, as far as the sequence
      // is concerned — the next successful allocation reuses that same
      // number rather than skipping past it.
      expect(numberAfterRollback).toBe(numberBeforeRollback);
    } finally {
      after.release();
    }
  });

  it("never produces a duplicate under concurrent allocation for the same tenant", async () => {
    await client.query(
      "delete from order_number_counters where tenant_id = $1",
      [tenantB],
    );

    const results = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const conn = await pool.connect();
        try {
          await conn.query("begin");
          const number = await allocateOrderNumber(conn, tenantB);
          await conn.query("commit");
          return number;
        } finally {
          conn.release();
        }
      }),
    );

    expect(new Set(results).size).toBe(10);
  });
});
