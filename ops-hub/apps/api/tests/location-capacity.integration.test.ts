import { randomUUID } from "node:crypto";

import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { InventoryValidationError } from "../src/inventory/errors";
import { PgBinStore } from "../src/inventory/pg-store";
import { PgLocationStore } from "../src/inventory/pg-store";
import { InventoryService } from "../src/inventory/service";
import { PgStockStore } from "../src/stock/pg-store";
import { StockService } from "../src/stock/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantId = "00000000-0000-4000-8000-00000000c002";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const inventory = new InventoryService({
  locations: new PgLocationStore(pool),
  bins: new PgBinStore(pool),
  clock: systemClock,
});
const stock = new StockService({
  store: new PgStockStore(pool),
  clock: systemClock,
});

async function createVariant(sku: string): Promise<string> {
  const productId = randomUUID();
  await client.query(
    `insert into products (id, tenant_id, kind, name_ar, name_en) values ($1, $2, 'simple', 'منتج', 'Product')`,
    [productId, tenantId],
  );
  const variantId = randomUUID();
  await client.query(
    `insert into variants (id, tenant_id, product_id, sku) values ($1, $2, $3, $4)`,
    [variantId, tenantId, productId, sku],
  );
  return variantId;
}

describe.skipIf(!runDbTests)(
  "Location capacity and utilization against Postgres",
  () => {
    beforeAll(async () => {
      await client.connect();
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
      await client.query("delete from variants where tenant_id = $1", [
        tenantId,
      ]);
      await client.query("delete from products where tenant_id = $1", [
        tenantId,
      ]);
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query(
        "insert into tenants (id, slug, name) values ($1, 'capacity-test', 'Capacity Test')",
        [tenantId],
      );
    });

    afterAll(async () => {
      await client.end();
      await pool.end();
    });

    it("creates a location with a capacity and reports it empty", async () => {
      const created = await inventory.createLocation(
        { type: "warehouse", name: "Cap WH", capacity: 100 },
        tenantId,
      );
      const read = await inventory.getLocation(tenantId, created.id);

      expect(read.capacity).toBe(100);
      expect(read.usedUnits).toBe(0);
      expect(read.utilizationPercent).toBe(0);
    });

    it("counts on-hand units across every variant at the location", async () => {
      const created = await inventory.createLocation(
        { type: "warehouse", name: "Filled WH", capacity: 60 },
        tenantId,
      );
      const shirts = await createVariant("CAP-SHIRT");
      const socks = await createVariant("CAP-SOCKS");
      await stock.recordMovement(
        {
          variantId: shirts,
          locationId: created.id,
          bucket: "on_hand",
          delta: 25,
          reason: "OPENING",
        },
        tenantId,
        null,
      );
      await stock.recordMovement(
        {
          variantId: socks,
          locationId: created.id,
          bucket: "on_hand",
          delta: 5,
          reason: "OPENING",
        },
        tenantId,
        null,
      );

      const read = await inventory.getLocation(tenantId, created.id);
      expect(read.usedUnits).toBe(30);
      expect(read.utilizationPercent).toBe(50);
    });

    it("changes capacity without moving stock, and removes the limit with null", async () => {
      const created = await inventory.createLocation(
        { type: "warehouse", name: "Resize WH", capacity: 100 },
        tenantId,
      );
      const variant = await createVariant("CAP-RESIZE");
      await stock.recordMovement(
        {
          variantId: variant,
          locationId: created.id,
          bucket: "on_hand",
          delta: 20,
          reason: "OPENING",
        },
        tenantId,
        null,
      );

      const resized = await inventory.updateLocationCapacity(
        tenantId,
        created.id,
        40,
      );
      expect(resized.capacity).toBe(40);
      expect(resized.usedUnits).toBe(20);
      expect(resized.utilizationPercent).toBe(50);

      const unlimited = await inventory.updateLocationCapacity(
        tenantId,
        created.id,
        null,
      );
      expect(unlimited.capacity).toBeNull();
      expect(unlimited.utilizationPercent).toBeNull();
    });

    it("reports more than 100% when stock is over the configured capacity", async () => {
      const created = await inventory.createLocation(
        { type: "warehouse", name: "Over WH", capacity: 20 },
        tenantId,
      );
      const variant = await createVariant("CAP-OVER");
      await stock.recordMovement(
        {
          variantId: variant,
          locationId: created.id,
          bucket: "on_hand",
          delta: 30,
          reason: "OPENING",
        },
        tenantId,
        null,
      );
      const read = await inventory.getLocation(tenantId, created.id);
      expect(read.utilizationPercent).toBe(150);
    });

    it.each([0, -5, 2.5, "100"])(
      "rejects capacity %j on create and update",
      async (capacity) => {
        await expect(
          inventory.createLocation(
            { type: "warehouse", name: "Bad WH", capacity: capacity as number },
            tenantId,
          ),
        ).rejects.toBeInstanceOf(InventoryValidationError);

        const created = await inventory.createLocation(
          { type: "warehouse", name: "Bad WH 2" },
          tenantId,
        );
        await expect(
          inventory.updateLocationCapacity(tenantId, created.id, capacity),
        ).rejects.toBeInstanceOf(InventoryValidationError);
      },
    );
  },
);
