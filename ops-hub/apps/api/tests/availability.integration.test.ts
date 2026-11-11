import { randomUUID } from "node:crypto";

import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AvailabilityService } from "../src/availability/service";
import { PgTenantPolicyReader } from "../src/availability/pg-tenant-policy";
import { PgVariantStore } from "../src/catalog/pg-store";
import { PgStockStore } from "../src/stock/pg-store";
import { StockService } from "../src/stock/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000000701";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const stockStore = new PgStockStore(pool);
const stock = new StockService({ store: stockStore, clock: systemClock });
const availability = new AvailabilityService({
  variants: new PgVariantStore(pool),
  balances: stockStore,
  policy: new PgTenantPolicyReader(pool),
});

describe.skipIf(!runDbTests)("Availability against Postgres", () => {
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
      "insert into tenants (id, slug, name) values ($1, 'avail-a', 'Availability Tenant A')",
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

  it("computes ATP end-to-end from real stock movements", async () => {
    const productId = randomUUID();
    await client.query(
      `insert into products (id, tenant_id, kind, name_ar, name_en)
       values ($1, $2, 'simple', 'منتج', 'Product')`,
      [productId, tenantA],
    );
    const variantId = randomUUID();
    await client.query(
      `insert into variants (id, tenant_id, product_id, sku) values ($1, $2, $3, $4)`,
      [variantId, tenantA, productId, "AVAIL-E2E-001"],
    );
    const locationId = randomUUID();
    await client.query(
      `insert into locations (id, tenant_id, type, name) values ($1, $2, 'warehouse', 'E2E WH')`,
      [locationId, tenantA],
    );

    await stock.recordMovement(
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
    await stock.recordMovement(
      {
        variantId,
        locationId,
        bucket: "reserved",
        delta: 6,
        reason: "ALLOCATE",
      },
      tenantA,
      null,
    );

    const result = await availability.getAvailability(tenantA, "AVAIL-E2E-001");

    expect(result.variantId).toBe(variantId);
    expect(result.locations).toEqual([
      {
        locationId,
        onHand: 20,
        reserved: 6,
        quarantined: 0,
        damaged: 0,
        availableToPromise: 14,
      },
    ]);
    expect(result.total.availableToPromise).toBe(14);
  });

  it("defaults to clamping a negative total at zero for a fresh tenant", async () => {
    const policy = await new PgTenantPolicyReader(pool).allowsNegativeStock(
      tenantA,
    );
    expect(policy).toBe(false);
  });
});
