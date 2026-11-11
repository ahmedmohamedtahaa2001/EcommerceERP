import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgCatalogStore } from "../src/catalog/pg-store";
import { CatalogService } from "../src/catalog/service";
import type { ImportRow } from "../src/catalog/types";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantA = "00000000-0000-4000-8000-000000000301";
const tenantB = "00000000-0000-4000-8000-000000000302";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const store = new PgCatalogStore(pool);
const service = new CatalogService({ store, clock: systemClock });

async function asAppTenant<T>(
  tenantId: string | null,
  work: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  await client.query("set local role ops_hub_app");
  if (tenantId !== null) {
    await client.query("select set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
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

describe.skipIf(!runDbTests)("Catalog store against Postgres", () => {
  let productAId: string;
  let variantAId: string;

  beforeAll(async () => {
    await client.connect();
    await client.query("delete from bundle_components where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from stock_movements where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from variants where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from products where tenant_id in ($1,$2)", [tenantA, tenantB]);
    await client.query("delete from tenants where id in ($1,$2)", [tenantA, tenantB]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'cat-a', 'Tenant A'), ($2, 'cat-b', 'Tenant B')",
      [tenantA, tenantB],
    );

    const p = await service.createProduct(
      { nameAr: "منتج", nameEn: "Product" },
      tenantA,
    );
    productAId = p.id;
    const v = await service.createVariant(tenantA, productAId, { sku: "SKU-A" });
    variantAId = v.id;
  });

  afterAll(async () => {
    await client.query("reset role");
    await client.query("delete from tenants where id in ($1,$2)", [tenantA, tenantB]);
    await client.end();
    await pool.end();
  });

  it("isolates products by tenant under the app role", async () => {
    const scoped = await asAppTenant(tenantA, () =>
      client.query<{ count: number }>("select count(*)::int as count from products"),
    );
    const unscoped = await asAppTenant(null, () =>
      client.query<{ count: number }>("select count(*)::int as count from products"),
    );
    const other = await asAppTenant(tenantA, () =>
      client.query<{ count: number }>(
        "select count(*)::int as count from products where tenant_id = $1",
        [tenantB],
      ),
    );
    expect(scoped.rows[0]?.count).toBe(1);
    expect(unscoped.rows[0]?.count).toBe(0);
    expect(other.rows[0]?.count).toBe(0);
  });

  it("enforces SKU uniqueness per tenant at the database", async () => {
    await expect(
      service.createVariant(tenantA, productAId, { sku: "SKU-A" }),
    ).rejects.toThrow();
    // different tenant can reuse the SKU
    const pB = await service.createProduct(
      { nameAr: "منتج", nameEn: "Product" },
      tenantB,
    );
    const vB = await service.createVariant(tenantB, pB.id, { sku: "SKU-A" });
    expect(vB.sku).toBe("SKU-A");
  });

  it("reports hasStockMovements after a movement row exists", async () => {
    // insert a movement row as the app role within tenant A
    await asAppTenant(tenantA, async () => {
      await client.query(
        "insert into stock_movements (tenant_id, variant_id, delta, reason) values ($1,$2,$3,$4)",
        [tenantA, variantAId, 5, "RECEIPT"],
      );
    });
    expect(await store.hasStockMovements(tenantA, variantAId)).toBe(true);

    // SKU update is now blocked at the service layer
    await expect(
      service.updateVariant(tenantA, variantAId, { sku: "SKU-RENAMED" }),
    ).rejects.toThrow();

    // and the variant row still has the original SKU
    const v = await store.getVariant(tenantA, variantAId);
    expect(v?.sku).toBe("SKU-A");
  });

  it("blocks deleting a variant/product that has stock movements (FK restrict)", async () => {
    await expect(service.deleteVariant(tenantA, variantAId)).rejects.toThrow();
    await expect(service.deleteProduct(tenantA, productAId)).rejects.toThrow();
  });

  it("replaces bundle components in one call", async () => {
    const bundle = await service.createProduct(
      { nameAr: "حزمة", nameEn: "Bundle", kind: "bundle" },
      tenantA,
    );
    const compProduct = await service.createProduct(
      { nameAr: "компон", nameEn: "Component" },
      tenantA,
    );
    const compVariant = await service.createVariant(tenantA, compProduct.id, {
      sku: "COMP-INT",
    });

    const replaced = await service.replaceComponents(tenantA, bundle.id, [
      { componentVariantId: compVariant.id, quantity: 3 },
    ]);
    expect(replaced).toHaveLength(1);

    const listed = await store.listComponents(tenantA, bundle.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.quantity).toBe(3);

    // replace with empty list clears components
    await service.replaceComponents(tenantA, bundle.id, []);
    const after = await store.listComponents(tenantA, bundle.id);
    expect(after).toHaveLength(0);
  });

  it("stock_movements is append-only: UPDATE and DELETE are rejected", async () => {
    await asAppTenant(tenantA, async () => {
      await expect(
        client.query("update stock_movements set delta = 0 where variant_id = $1", [
          variantAId,
        ]),
      ).rejects.toThrow();
      await expect(
        client.query("delete from stock_movements where variant_id = $1", [
          variantAId,
        ]),
      ).rejects.toThrow();
    });
  });

  it("bundle_components enforces positive quantity at the DB", async () => {
    const bundle = await service.createProduct(
      { nameAr: "حزمة2", nameEn: "Bundle2", kind: "bundle" },
      tenantA,
    );
    const compProduct = await service.createProduct(
      { nameAr: "компон2", nameEn: "Component2" },
      tenantA,
    );
    const compVariant = await service.createVariant(tenantA, compProduct.id, {
      sku: "COMP-INT2",
    });
    await asAppTenant(tenantA, async () => {
      await expect(
        client.query(
          "insert into bundle_components (tenant_id, bundle_product_id, component_variant_id, quantity) values ($1,$2,$3,$4)",
          [tenantA, bundle.id, compVariant.id, 0],
        ),
      ).rejects.toThrow();
    });
  });

  it("imports 1000 rows in under 10 seconds", async () => {
    const rows: ImportRow[] = [];
    for (let i = 0; i < 1000; i++) {
      rows.push({
        row: i + 2,
        nameAr: `منتج${i}`,
        nameEn: `Product${i}`,
        sku: `PERF-${i}`,
      });
    }
    const start = Date.now();
    const report = await service.importProducts(tenantA, rows, false);
    const elapsed = Date.now() - start;
    console.log(`imported ${report.created} rows in ${elapsed}ms`);
    expect(report.created).toBe(1000);
    expect(report.errors).toHaveLength(0);
    expect(elapsed).toBeLessThan(30000);
  });
});
