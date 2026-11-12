import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DuplicateBarcodeError } from "../src/catalog/errors";
import { PgProductStore, PgVariantStore } from "../src/catalog/pg-store";
import { CatalogService } from "../src/catalog/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantId = "00000000-0000-4000-8000-00000000a002";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const service = new CatalogService({
  products: new PgProductStore(pool),
  variants: new PgVariantStore(pool),
  clock: systemClock,
});

describe.skipIf(!runDbTests)("Catalog attributes against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from variants where tenant_id = $1", [tenantId]);
    await client.query("delete from products where tenant_id = $1", [tenantId]);
    await client.query("delete from tenants where id = $1", [tenantId]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'catalog-attr-test', 'Catalog Attr Test')",
      [tenantId],
    );
  });

  afterAll(async () => {
    await client.end();
    await pool.end();
  });

  it("persists and reads back product attributes", async () => {
    const created = await service.createProduct(
      {
        nameEn: "Linen Shirt",
        nameAr: "قميص كتان",
        category: "Apparel",
        brand: "Acme",
        tags: ["summer", "linen"],
        isHazardous: false,
      },
      tenantId,
    );
    const read = await service.getProduct(tenantId, created.id);
    expect(read.category).toBe("Apparel");
    expect(read.brand).toBe("Acme");
    expect(read.tags).toEqual(["summer", "linen"]);
    expect(read.isHazardous).toBe(false);

    const updated = await service.updateProduct(tenantId, created.id, {
      category: null,
      tags: ["clearance"],
      isHazardous: true,
    });
    expect(updated.category).toBeNull();
    expect(updated.brand).toBe("Acme");
    expect(updated.tags).toEqual(["clearance"]);
    expect(updated.isHazardous).toBe(true);
  });

  it("persists price, currency, barcode, weight and dimensions on a variant", async () => {
    const product = await service.createProduct(
      { nameEn: "Mug", nameAr: "كوب" },
      tenantId,
    );
    const variant = await service.createVariant(
      {
        productId: product.id,
        sku: "MUG-1",
        barcode: "4006381333931",
        weightGrams: 320,
        dimensions: { lengthCm: 9, widthCm: 9, heightCm: 10 },
        priceMinor: 8500,
        currency: "EGP",
      },
      tenantId,
    );

    const read = await service.getVariant(tenantId, variant.id);
    expect(read.barcode).toBe("4006381333931");
    expect(read.weightGrams).toBe(320);
    expect(read.dimensions).toEqual({ lengthCm: 9, widthCm: 9, heightCm: 10 });
    expect(read.priceMinor).toBe(8500);
    expect(read.currency).toBe("EGP");

    const repriced = await service.updateVariant(tenantId, variant.id, {
      priceMinor: 7900,
      currency: "USD",
    });
    expect(repriced.priceMinor).toBe(7900);
    expect(repriced.currency).toBe("USD");
  });

  it("enforces barcode uniqueness per tenant in the database", async () => {
    const product = await service.createProduct(
      { nameEn: "Cap", nameAr: "قبعة" },
      tenantId,
    );
    await service.createVariant(
      { productId: product.id, sku: "CAP-1", barcode: "BC-DUP-1" },
      tenantId,
    );
    await expect(
      service.createVariant(
        { productId: product.id, sku: "CAP-2", barcode: "BC-DUP-1" },
        tenantId,
      ),
    ).rejects.toBeInstanceOf(DuplicateBarcodeError);
  });

  it("allows the same barcode in a different tenant", async () => {
    const otherTenant = "00000000-0000-4000-8000-00000000a003";
    await client.query("delete from variants where tenant_id = $1", [
      otherTenant,
    ]);
    await client.query("delete from products where tenant_id = $1", [
      otherTenant,
    ]);
    await client.query("delete from tenants where id = $1", [otherTenant]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'catalog-attr-other', 'Other')",
      [otherTenant],
    );
    const product = await service.createProduct(
      { nameEn: "Cap", nameAr: "قبعة" },
      otherTenant,
    );
    const variant = await service.createVariant(
      { productId: product.id, sku: "CAP-X", barcode: "BC-DUP-1" },
      otherTenant,
    );
    expect(variant.barcode).toBe("BC-DUP-1");
    await client.query("delete from variants where tenant_id = $1", [
      otherTenant,
    ]);
    await client.query("delete from products where tenant_id = $1", [
      otherTenant,
    ]);
    await client.query("delete from tenants where id = $1", [otherTenant]);
  });
});
