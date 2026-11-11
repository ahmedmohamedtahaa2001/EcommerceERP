import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CatalogValidationError,
  DuplicateSkuError,
  ProductNotFoundError,
  VariantNotFoundError,
} from "../src/catalog/errors";
import { PgProductStore, PgVariantStore } from "../src/catalog/pg-store";
import { CatalogService } from "../src/catalog/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000000301";
const tenantB = "00000000-0000-4000-8000-000000000302";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const service = new CatalogService({
  products: new PgProductStore(pool),
  variants: new PgVariantStore(pool),
  clock: systemClock,
});

describe.skipIf(!runDbTests)("Catalog service against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from variants where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from products where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'cat-a', 'Tenant A'), ($2, 'cat-b', 'Tenant B')",
      [tenantA, tenantB],
    );
  });

  afterAll(async () => {
    await client.query("delete from variants where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from products where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.end();
    await pool.end();
  });

  it("creates a product (defaulting to draft/simple) and reads it back", async () => {
    const product = await service.createProduct(
      { nameEn: "T-Shirt", nameAr: "تيشيرت" },
      tenantA,
    );

    expect(product.status).toBe("draft");
    expect(product.kind).toBe("simple");
    await expect(
      service.getProduct(tenantA, product.id),
    ).resolves.toMatchObject({ nameEn: "T-Shirt" });
  });

  it("isolates products by tenant", async () => {
    const product = await service.createProduct(
      { nameEn: "Tenant A only", nameAr: "منتج" },
      tenantA,
    );

    await expect(service.getProduct(tenantB, product.id)).rejects.toThrow(
      ProductNotFoundError,
    );
  });

  it("creates a variant with a unique SKU per tenant", async () => {
    const product = await service.createProduct(
      { nameEn: "Mug", nameAr: "كوب" },
      tenantA,
    );

    const variant = await service.createVariant(
      {
        productId: product.id,
        sku: "MUG-RED-001",
        attributes: { color: "red" },
      },
      tenantA,
    );

    expect(variant.attributes).toEqual({ color: "red" });
    await expect(
      service.getVariant(tenantA, variant.id),
    ).resolves.toMatchObject({ sku: "MUG-RED-001" });
  });

  it("rejects a duplicate SKU within the same tenant with 409 semantics", async () => {
    const product = await service.createProduct(
      { nameEn: "Cap", nameAr: "كاب" },
      tenantA,
    );
    await service.createVariant(
      { productId: product.id, sku: "CAP-001" },
      tenantA,
    );

    const duplicate = service.createVariant(
      { productId: product.id, sku: "CAP-001" },
      tenantA,
    );
    await expect(duplicate).rejects.toThrow(DuplicateSkuError);
    await expect(duplicate).rejects.toMatchObject({ statusCode: 409 });
  });

  it("allows the same SKU in a different tenant", async () => {
    const productA = await service.createProduct(
      { nameEn: "Shared SKU A", nameAr: "منتج" },
      tenantA,
    );
    const productB = await service.createProduct(
      { nameEn: "Shared SKU B", nameAr: "منتج" },
      tenantB,
    );

    await service.createVariant(
      { productId: productA.id, sku: "SHARED-001" },
      tenantA,
    );

    await expect(
      service.createVariant(
        { productId: productB.id, sku: "SHARED-001" },
        tenantB,
      ),
    ).resolves.toMatchObject({ sku: "SHARED-001" });
  });

  it("never accepts sku on a variant update: it is immutable once created", async () => {
    const product = await service.createProduct(
      { nameEn: "Immutable SKU", nameAr: "منتج" },
      tenantA,
    );
    const variant = await service.createVariant(
      { productId: product.id, sku: "IMMUTABLE-001" },
      tenantA,
    );

    // The update request type has no `sku` field; the HTTP layer rejects a
    // body containing one before the service is ever called (see
    // catalog/routes.ts). Here we confirm the service's update path can only
    // ever change non-SKU fields and the SKU survives unchanged.
    const updated = await service.updateVariant(tenantA, variant.id, {
      attributes: { size: "L" },
    });

    expect(updated.sku).toBe("IMMUTABLE-001");
    expect(updated.attributes).toEqual({ size: "L" });
  });

  it("rejects an unknown product id when creating a variant", async () => {
    await expect(
      service.createVariant(
        {
          productId: "00000000-0000-4000-8000-000000000999",
          sku: "ORPHAN-001",
        },
        tenantA,
      ),
    ).rejects.toThrow(ProductNotFoundError);
  });

  it("rejects a 404 update and a validation error distinctly", async () => {
    await expect(
      service.updateProduct(tenantA, "00000000-0000-4000-8000-000000000999", {
        nameEn: "x",
      }),
    ).rejects.toThrow(ProductNotFoundError);

    const product = await service.createProduct(
      { nameEn: "Bad status", nameAr: "منتج" },
      tenantA,
    );
    await expect(
      service.updateProduct(tenantA, product.id, {
        status: "not-a-real-status" as never,
      }),
    ).rejects.toThrow(CatalogValidationError);
  });

  it("rejects an unknown variant id on update with 404 semantics", async () => {
    await expect(
      service.updateVariant(tenantA, "00000000-0000-4000-8000-000000000999", {
        attributes: { size: "L" },
      }),
    ).rejects.toThrow(VariantNotFoundError);
  });
});
