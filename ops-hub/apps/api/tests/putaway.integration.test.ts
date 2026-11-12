import { randomUUID } from "node:crypto";

import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgBinStore } from "../src/inventory/pg-store";
import { PgStockStore } from "../src/stock/pg-store";
import { StockService } from "../src/stock/service";
import {
  BinCapacityError,
  BinNotFoundError,
  PutawayValidationError,
  UnassignedStockError,
} from "../src/putaway/errors";
import { PutawayService } from "../src/putaway/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantId = "00000000-0000-4000-8000-00000000c001";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const putaway = new PutawayService(pool);
const stock = new StockService({
  store: new PgStockStore(pool),
  clock: systemClock,
});
const bins = new PgBinStore(pool);

async function createBin(
  locationId: string,
  code: string,
  capacity: number | null,
) {
  const id = randomUUID();
  await client.query(
    `insert into bins (id, tenant_id, location_id, code, capacity) values ($1, $2, $3, $4, $5)`,
    [id, tenantId, locationId, code, capacity],
  );
  return id;
}

async function binQuantity(binId: string, variantId: string): Promise<number> {
  const result = await client.query<{ quantity: number }>(
    `select quantity from bin_stock where bin_id = $1 and variant_id = $2`,
    [binId, variantId],
  );
  return result.rows[0]?.quantity ?? 0;
}

describe.skipIf(!runDbTests)("Putaway into bins against Postgres", () => {
  let locationId: string;
  let variantId: string;

  beforeAll(async () => {
    await client.connect();
    await client.query("delete from bin_stock where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from stock_movements where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from stock_balances where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from bins where tenant_id = $1", [tenantId]);
    await client.query("delete from locations where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from variants where tenant_id = $1", [tenantId]);
    await client.query("delete from products where tenant_id = $1", [tenantId]);
    await client.query("delete from tenants where id = $1", [tenantId]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'putaway-test', 'Putaway Test')",
      [tenantId],
    );

    locationId = randomUUID();
    await client.query(
      `insert into locations (id, tenant_id, type, name) values ($1, $2, 'warehouse', 'Putaway WH')`,
      [locationId, tenantId],
    );
    const productId = randomUUID();
    await client.query(
      `insert into products (id, tenant_id, kind, name_ar, name_en) values ($1, $2, 'simple', 'منتج', 'Product')`,
      [productId, tenantId],
    );
    variantId = randomUUID();
    await client.query(
      `insert into variants (id, tenant_id, product_id, sku) values ($1, $2, $3, 'PUT-1')`,
      [variantId, tenantId, productId],
    );
    await stock.recordMovement(
      {
        variantId,
        locationId,
        bucket: "on_hand",
        delta: 10,
        reason: "OPENING",
      },
      tenantId,
      null,
    );
  });

  afterAll(async () => {
    await client.end();
    await pool.end();
  });

  it("places on-hand stock into a bin and leaves the rest unassigned", async () => {
    const binA = await createBin(locationId, "A-01", null);
    const result = await putaway.putAway(tenantId, binA, {
      variantId,
      quantity: 6,
    });

    expect(result.binQuantity).toBe(6);
    expect(result.unassignedAfter).toBe(4);
    expect(await binQuantity(binA, variantId)).toBe(6);
  });

  it("refuses more than the unassigned on-hand stock and changes nothing", async () => {
    const binB = await createBin(locationId, "B-01", null);
    await expect(
      putaway.putAway(tenantId, binB, { variantId, quantity: 5 }),
    ).rejects.toBeInstanceOf(UnassignedStockError);
    expect(await binQuantity(binB, variantId)).toBe(0);
  });

  it("refuses to overfill a bin with a capacity", async () => {
    const capped = await createBin(locationId, "C-01", 3);
    await expect(
      putaway.putAway(tenantId, capped, { variantId, quantity: 4 }),
    ).rejects.toBeInstanceOf(BinCapacityError);
    await putaway.putAway(tenantId, capped, { variantId, quantity: 3 });
    expect(await binQuantity(capped, variantId)).toBe(3);
  });

  it("reports an unknown bin and rejects a non-positive quantity", async () => {
    await expect(
      putaway.putAway(tenantId, randomUUID(), { variantId, quantity: 1 }),
    ).rejects.toBeInstanceOf(BinNotFoundError);
    const someBin = await createBin(locationId, "D-01", null);
    await expect(
      putaway.putAway(tenantId, someBin, { variantId, quantity: 0 }),
    ).rejects.toBeInstanceOf(PutawayValidationError);
  });

  it("lets only one of two concurrent put-aways claim the last units", async () => {
    // 1 unassigned unit remains: 10 on hand, 6 in A-01, 3 in C-01.
    const first = await createBin(locationId, "E-01", null);
    const second = await createBin(locationId, "E-02", null);
    const outcomes = await Promise.allSettled([
      putaway.putAway(tenantId, first, { variantId, quantity: 1 }),
      putaway.putAway(tenantId, second, { variantId, quantity: 1 }),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      UnassignedStockError,
    );
  });

  it("lists what each bin holds and its usage", async () => {
    const contents = await putaway.contents(
      tenantId,
      (await bins.listByLocation(tenantId, locationId))[0]!.id,
    );
    expect(contents).toEqual([{ variantId, sku: "PUT-1", quantity: 6 }]);

    const listed = await bins.listByLocation(tenantId, locationId);
    const capped = listed.find((bin) => bin.code === "C-01");
    expect(capped?.used).toBe(3);
    expect(capped?.capacity).toBe(3);
  });
});
