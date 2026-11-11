import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgLocationStore } from "../src/locations/pg-store";
import { LocationService } from "../src/locations/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantA = "00000000-0000-4000-8000-000000000401";
const tenantB = "00000000-0000-4000-8000-000000000402";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const store = new PgLocationStore(pool);
const service = new LocationService({ store, clock: { now: () => new Date() } as never });

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

describe.skipIf(!runDbTests)("Locations store against Postgres", () => {
  let locationId: string;

  beforeAll(async () => {
    await client.connect();
    await client.query("delete from bins where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from locations where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from tenants where id in ($1,$2)", [tenantA, tenantB]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'loc-a', 'Tenant A'), ($2, 'loc-b', 'Tenant B')",
      [tenantA, tenantB],
    );
    const loc = await service.createLocation({ type: "warehouse", name: "WH", code: "WH-1" }, tenantA);
    locationId = loc.id;
  });

  afterAll(async () => {
    await client.query("reset role");
    await client.query("delete from tenants where id in ($1,$2)", [tenantA, tenantB]);
    await client.end();
    await pool.end();
  });

  it("isolates locations by tenant under the app role", async () => {
    const scoped = await asAppTenant(tenantA, () =>
      client.query<{ count: number }>("select count(*)::int as count from locations"),
    );
    const unscoped = await asAppTenant(null, () =>
      client.query<{ count: number }>("select count(*)::int as count from locations"),
    );
    expect(scoped.rows[0]?.count).toBe(1);
    expect(unscoped.rows[0]?.count).toBe(0);
  });

  it("enforces bin code uniqueness per location at the DB", async () => {
    await service.createBin(tenantA, locationId, { code: "BIN-1" });
    await expect(
      service.createBin(tenantA, locationId, { code: "BIN-1" }),
    ).rejects.toThrow();
  });

  it("blocks deleting a location that has stock movements", async () => {
    // seed a product + variant in tenant A
    const prodRes = await client.query<{ id: string }>(
      "insert into products (tenant_id, name_ar, name_en) values ($1, 'p', 'p') returning id",
      [tenantA],
    );
    const productId = prodRes.rows[0]!.id;
    const varRes = await client.query<{ id: string }>(
      "insert into variants (tenant_id, product_id, sku) values ($1, $2, 'LV') returning id",
      [tenantA, productId],
    );
    const variantId = varRes.rows[0]!.id;

    await asAppTenant(tenantA, async () => {
      await client.query(
        "insert into stock_movements (tenant_id, variant_id, location_id, delta, reason) values ($1, $2, $3, 1, 'RECEIPT')",
        [tenantA, variantId, locationId],
      );
    });

    await expect(service.deleteLocation(tenantA, locationId)).rejects.toThrow();
  });
});
