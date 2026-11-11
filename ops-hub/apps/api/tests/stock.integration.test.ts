import { randomUUID } from "node:crypto";

import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  StockReferenceNotFoundError,
  StockValidationError,
} from "../src/stock/errors";
import { PgStockStore } from "../src/stock/pg-store";
import { StockService } from "../src/stock/service";
import type { StockBucket } from "../src/stock/types";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000000601";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const service = new StockService({
  store: new PgStockStore(pool),
  clock: systemClock,
});

async function createVariant(sku: string): Promise<string> {
  const productId = randomUUID();
  await client.query(
    `insert into products (id, tenant_id, kind, name_ar, name_en)
     values ($1, $2, 'simple', 'منتج', 'Product')`,
    [productId, tenantA],
  );
  const variantId = randomUUID();
  await client.query(
    `insert into variants (id, tenant_id, product_id, sku) values ($1, $2, $3, $4)`,
    [variantId, tenantA, productId, sku],
  );
  return variantId;
}

async function createLocation(name: string): Promise<string> {
  const locationId = randomUUID();
  await client.query(
    `insert into locations (id, tenant_id, type, name) values ($1, $2, 'warehouse', $3)`,
    [locationId, tenantA, name],
  );
  return locationId;
}

async function balanceOf(
  variantId: string,
  locationId: string,
  bucket: string,
): Promise<number> {
  const result = await client.query<{ quantity: number }>(
    `select quantity from stock_balances
      where tenant_id = $1 and variant_id = $2 and location_id = $3 and bucket = $4`,
    [tenantA, variantId, locationId, bucket],
  );
  return result.rows[0]?.quantity ?? 0;
}

describe.skipIf(!runDbTests)("Stock ledger against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from stock_movements where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from stock_balances where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from variants where tenant_id = $1", [tenantA]);
    await client.query("delete from products where tenant_id = $1", [tenantA]);
    await client.query("delete from locations where tenant_id = $1", [tenantA]);
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'stock-a', 'Stock Tenant A')",
      [tenantA],
    );
  });

  afterAll(async () => {
    await client.query("delete from stock_movements where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from stock_balances where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from variants where tenant_id = $1", [tenantA]);
    await client.query("delete from products where tenant_id = $1", [tenantA]);
    await client.query("delete from locations where tenant_id = $1", [tenantA]);
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.end();
    await pool.end();
  });

  it("records a movement and derives the balance from it", async () => {
    const variantId = await createVariant("STK-001");
    const locationId = await createLocation("WH A");

    const { movement, balance } = await service.recordMovement(
      {
        variantId,
        locationId,
        bucket: "on_hand",
        delta: 10,
        reason: "RECEIVE",
      },
      tenantA,
      { type: "user", id: randomUUID() },
    );

    expect(movement.delta).toBe(10);
    expect(balance.quantity).toBe(10);
    expect(await balanceOf(variantId, locationId, "on_hand")).toBe(10);
  });

  it("accumulates balance across multiple movements in the same bucket", async () => {
    const variantId = await createVariant("STK-002");
    const locationId = await createLocation("WH B");

    await service.recordMovement(
      {
        variantId,
        locationId,
        bucket: "on_hand",
        delta: 20,
        reason: "RECEIVE",
      },
      tenantA,
      null,
    );
    await service.recordMovement(
      { variantId, locationId, bucket: "on_hand", delta: -5, reason: "PICK" },
      tenantA,
      null,
    );

    expect(await balanceOf(variantId, locationId, "on_hand")).toBe(15);
  });

  it("keeps buckets independent for the same variant and location", async () => {
    const variantId = await createVariant("STK-003");
    const locationId = await createLocation("WH C");

    await service.recordMovement(
      {
        variantId,
        locationId,
        bucket: "on_hand",
        delta: 10,
        reason: "RECEIVE",
      },
      tenantA,
      null,
    );
    await service.recordMovement(
      { variantId, locationId, bucket: "damaged", delta: 3, reason: "DAMAGE" },
      tenantA,
      null,
    );

    expect(await balanceOf(variantId, locationId, "on_hand")).toBe(10);
    expect(await balanceOf(variantId, locationId, "damaged")).toBe(3);
  });

  it("rejects a zero delta and an unknown bucket", async () => {
    const variantId = await createVariant("STK-004");
    const locationId = await createLocation("WH D");

    await expect(
      service.recordMovement(
        { variantId, locationId, bucket: "on_hand", delta: 0, reason: "NOOP" },
        tenantA,
        null,
      ),
    ).rejects.toThrow(StockValidationError);

    await expect(
      service.recordMovement(
        {
          variantId,
          locationId,
          bucket: "not_a_bucket" as StockBucket,
          delta: 1,
          reason: "BAD",
        },
        tenantA,
        null,
      ),
    ).rejects.toThrow(StockValidationError);
  });

  it("rejects a movement with no reason", async () => {
    const variantId = await createVariant("STK-005");
    const locationId = await createLocation("WH E");

    await expect(
      service.recordMovement(
        { variantId, locationId, bucket: "on_hand", delta: 1, reason: "" },
        tenantA,
        null,
      ),
    ).rejects.toThrow(StockValidationError);
  });

  it("rejects a movement against an unknown variant or location", async () => {
    const locationId = await createLocation("WH F");
    await expect(
      service.recordMovement(
        {
          variantId: "00000000-0000-4000-8000-000000000999",
          locationId,
          bucket: "on_hand",
          delta: 1,
          reason: "RECEIVE",
        },
        tenantA,
        null,
      ),
    ).rejects.toThrow(StockReferenceNotFoundError);
  });

  it("property: balance always equals the sum of movements, across random sequences", async () => {
    const buckets: StockBucket[] = [
      "on_hand",
      "reserved",
      "quarantined",
      "damaged",
      "in_transit",
    ];
    const variantIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      variantIds.push(await createVariant(`STK-PROP-${i}`));
    }
    const locationIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      locationIds.push(await createLocation(`WH PROP ${i}`));
    }

    const expected = new Map<string, number>();
    const key = (variantId: string, locationId: string, bucket: string) =>
      `${variantId}|${locationId}|${bucket}`;

    for (let i = 0; i < 200; i++) {
      const variantId =
        variantIds[Math.floor(Math.random() * variantIds.length)]!;
      const locationId =
        locationIds[Math.floor(Math.random() * locationIds.length)]!;
      const bucket = buckets[Math.floor(Math.random() * buckets.length)]!;
      // Never zero: Math.random() * 40 - 20, re-rolled if it rounds to 0.
      let delta = 0;
      while (delta === 0) {
        delta = Math.round(Math.random() * 40 - 20);
      }

      await service.recordMovement(
        { variantId, locationId, bucket, delta, reason: `RANDOM-${i}` },
        tenantA,
        null,
      );

      const k = key(variantId, locationId, bucket);
      expected.set(k, (expected.get(k) ?? 0) + delta);
    }

    for (const [k, expectedQuantity] of expected) {
      const [variantId, locationId, bucket] = k.split("|") as [
        string,
        string,
        string,
      ];
      expect(await balanceOf(variantId, locationId, bucket)).toBe(
        expectedQuantity,
      );
    }

    // Independently: balance == sum of that key's movements, read straight
    // from the ledger rather than from the in-memory `expected` map.
    for (const variantId of variantIds) {
      for (const locationId of locationIds) {
        for (const bucket of buckets) {
          const sum = await client.query<{ total: string | null }>(
            `select sum(delta)::bigint as total from stock_movements
              where tenant_id = $1 and variant_id = $2 and location_id = $3 and bucket = $4`,
            [tenantA, variantId, locationId, bucket],
          );
          const expectedFromLedger = Number(sum.rows[0]?.total ?? 0);
          expect(await balanceOf(variantId, locationId, bucket)).toBe(
            expectedFromLedger,
          );
        }
      }
    }
  });
});
