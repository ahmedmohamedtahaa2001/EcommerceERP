import { randomUUID } from "node:crypto";

import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  DuplicateBinCodeError,
  LocationHasStockError,
  LocationNotFoundError,
} from "../src/inventory/errors";
import { PgBinStore, PgLocationStore } from "../src/inventory/pg-store";
import { InventoryService } from "../src/inventory/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000000501";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const service = new InventoryService({
  locations: new PgLocationStore(pool),
  bins: new PgBinStore(pool),
  clock: systemClock,
});

async function createVariant(tenantId: string, sku: string): Promise<string> {
  const productId = randomUUID();
  await client.query(
    `insert into products (id, tenant_id, kind, name_ar, name_en)
     values ($1, $2, 'simple', 'منتج', 'Product')`,
    [productId, tenantId],
  );
  const variantId = randomUUID();
  await client.query(
    `insert into variants (id, tenant_id, product_id, sku) values ($1, $2, $3, $4)`,
    [variantId, tenantId, productId, sku],
  );
  return variantId;
}

describe.skipIf(!runDbTests)("Inventory service against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from stock_balances where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from bins where tenant_id = $1", [tenantA]);
    await client.query("delete from locations where tenant_id = $1", [tenantA]);
    await client.query("delete from variants where tenant_id = $1", [tenantA]);
    await client.query("delete from products where tenant_id = $1", [tenantA]);
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'inv-a', 'Inventory Tenant A')",
      [tenantA],
    );
  });

  afterAll(async () => {
    await client.query("delete from stock_balances where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from bins where tenant_id = $1", [tenantA]);
    await client.query("delete from locations where tenant_id = $1", [tenantA]);
    await client.query("delete from variants where tenant_id = $1", [tenantA]);
    await client.query("delete from products where tenant_id = $1", [tenantA]);
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.end();
    await pool.end();
  });

  it("creates a location and reads it back", async () => {
    const location = await service.createLocation(
      { type: "warehouse", name: "Main Warehouse", code: "WH-1" },
      tenantA,
    );

    await expect(
      service.getLocation(tenantA, location.id),
    ).resolves.toMatchObject({
      name: "Main Warehouse",
      code: "WH-1",
    });
  });

  it("creates a bin under a location", async () => {
    const location = await service.createLocation(
      { type: "warehouse", name: "Bin Warehouse" },
      tenantA,
    );

    const bin = await service.createBin(
      { locationId: location.id, code: "A-01", zone: "A" },
      tenantA,
    );

    expect(bin.code).toBe("A-01");
  });

  it("rejects a duplicate bin code within the same location with 409 semantics", async () => {
    const location = await service.createLocation(
      { type: "warehouse", name: "Dup Bin Warehouse" },
      tenantA,
    );
    await service.createBin(
      { locationId: location.id, code: "DUP-01" },
      tenantA,
    );

    const duplicate = service.createBin(
      { locationId: location.id, code: "DUP-01" },
      tenantA,
    );
    await expect(duplicate).rejects.toThrow(DuplicateBinCodeError);
    await expect(duplicate).rejects.toMatchObject({ statusCode: 409 });
  });

  it("allows the same bin code in a different location", async () => {
    const locationA = await service.createLocation(
      { type: "warehouse", name: "Shared Code A" },
      tenantA,
    );
    const locationB = await service.createLocation(
      { type: "warehouse", name: "Shared Code B" },
      tenantA,
    );

    await service.createBin(
      { locationId: locationA.id, code: "SHARED" },
      tenantA,
    );
    await expect(
      service.createBin({ locationId: locationB.id, code: "SHARED" }, tenantA),
    ).resolves.toMatchObject({ code: "SHARED" });
  });

  it("deletes a location with no stock", async () => {
    const location = await service.createLocation(
      { type: "warehouse", name: "Empty Warehouse" },
      tenantA,
    );

    await service.deleteLocation(tenantA, location.id);
    await expect(service.getLocation(tenantA, location.id)).rejects.toThrow(
      LocationNotFoundError,
    );
  });

  it("rejects deleting a location that still has stock", async () => {
    const location = await service.createLocation(
      { type: "warehouse", name: "Stocked Warehouse" },
      tenantA,
    );
    const variantId = await createVariant(tenantA, "INV-STOCK-001");
    await client.query(
      `insert into stock_balances (tenant_id, variant_id, location_id, bucket, quantity)
       values ($1, $2, $3, 'on_hand', 10)`,
      [tenantA, variantId, location.id],
    );

    const deletion = service.deleteLocation(tenantA, location.id);
    await expect(deletion).rejects.toThrow(LocationHasStockError);
    await expect(deletion).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      service.getLocation(tenantA, location.id),
    ).resolves.toMatchObject({
      id: location.id,
    });
  });

  it("rejects an unknown location id on delete with 404 semantics", async () => {
    await expect(
      service.deleteLocation(tenantA, "00000000-0000-4000-8000-000000000999"),
    ).rejects.toThrow(LocationNotFoundError);
  });

  it("rejects creating a bin under an unknown location", async () => {
    await expect(
      service.createBin(
        { locationId: "00000000-0000-4000-8000-000000000999", code: "ORPHAN" },
        tenantA,
      ),
    ).rejects.toThrow(LocationNotFoundError);
  });
});
