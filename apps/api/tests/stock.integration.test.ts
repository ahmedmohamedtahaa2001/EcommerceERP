import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgStockStore } from "../src/stock/pg-store";
import { StockService } from "../src/stock/service";
import type { Bucket } from "../src/stock/types";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantA = "00000000-0000-4000-8000-000000000501";
const tenantB = "00000000-0000-4000-8000-000000000502";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const store = new PgStockStore(pool);
const service = new StockService({ store, clock: { now: () => new Date() } as never });

async function asAppTenant<T>(
  tenantId: string | null,
  work: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  await client.query("set local role ops_hub_app");
  if (tenantId !== null) {
    await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
  }
  try {
    const result = await work();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

describe.skipIf(!runDbTests)("Stock store against Postgres", () => {
  let variantId: string;
  let locationId: string;

  beforeAll(async () => {
    await client.connect();
    await client.query("delete from stock_balances where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from stock_movements where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from bins where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from locations where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from variants where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from products where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from tenants where id in ($1,$2)", [tenantA, tenantB]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'stk-a', 'Tenant A'), ($2, 'stk-b', 'Tenant B')",
      [tenantA, tenantB],
    );
    const prod = await client.query<{ id: string }>(
      "insert into products (tenant_id, name_ar, name_en) values ($1, 'p', 'p') returning id",
      [tenantA],
    );
    const v = await client.query<{ id: string }>(
      "insert into variants (tenant_id, product_id, sku) values ($1, $2, 'STK-V') returning id",
      [tenantA, prod.rows[0]!.id],
    );
    variantId = v.rows[0]!.id;
    const loc = await client.query<{ id: string }>(
      "insert into locations (tenant_id, type, name) values ($1, 'warehouse', 'WH') returning id",
      [tenantA],
    );
    locationId = loc.rows[0]!.id;
  });

  afterAll(async () => {
    await client.query("reset role");
    await client.query("delete from tenants where id in ($1,$2)", [tenantA, tenantB]);
    await client.end();
    await pool.end();
  });

  it("isolates stock_balances by tenant under the app role", async () => {
    await service.recordMovement(
      { variantId, locationId, bucket: "on_hand", delta: 5, reason: "R" },
      tenantA,
      { kind: "system", id: null },
    );
    const scoped = await asAppTenant(tenantA, () =>
      client.query<{ count: number }>("select count(*)::int as count from stock_balances"),
    );
    const unscoped = await asAppTenant(null, () =>
      client.query<{ count: number }>("select count(*)::int as count from stock_balances"),
    );
    expect(scoped.rows[0]?.count).toBe(1);
    expect(unscoped.rows[0]?.count).toBe(0);
  });

  it("balance equals sum of movements per bucket", async () => {
    const buckets: Bucket[] = ["on_hand", "reserved", "quarantined", "damaged", "in_transit"];
    const expected: Record<Bucket, number> = { on_hand: 5, reserved: 0, quarantined: 0, damaged: 0, in_transit: 0 };
    for (let i = 0; i < 50; i++) {
      const b = buckets[i % buckets.length];
      const d = (i % 7) - 3;
      expected[b] += d;
      await service.recordMovement(
        { variantId, locationId, bucket: b, delta: d, reason: "TEST" },
        tenantA,
        { kind: "system", id: null },
      );
    }
    const balances = await service.getBalances(tenantA, variantId, locationId);
    for (const b of buckets) {
      expect(balances[b]).toBe(expected[b]);
    }
    for (const b of buckets) {
      expect(await service.getBalance(tenantA, variantId, locationId, b)).toBe(expected[b]);
    }
  });

  it("accumulates balance via upsert on repeated movements", async () => {
    const before = await service.getBalance(tenantA, variantId, locationId, "on_hand");
    await service.recordMovement(
      { variantId, locationId, bucket: "on_hand", delta: 10, reason: "R" },
      tenantA,
      { kind: "system", id: null },
    );
    const after = await service.getBalance(tenantA, variantId, locationId, "on_hand");
    expect(after).toBe(before + 10);
  });

  it("stock_movements is append-only: UPDATE and DELETE are rejected", async () => {
    await asAppTenant(tenantA, async () => {
      await expect(
        client.query("update stock_movements set delta = 0 where variant_id = $1", [variantId]),
      ).rejects.toThrow();
      await expect(
        client.query("delete from stock_movements where variant_id = $1", [variantId]),
      ).rejects.toThrow();
    });
  });

  it("listMovements filters by variant and location", async () => {
    const list = await service.listMovements(tenantA, { variantId, locationId });
    expect(list.length).toBeGreaterThan(0);
    const all = await service.listMovements(tenantA, {});
    expect(all.length).toBe(list.length);
  });
});
