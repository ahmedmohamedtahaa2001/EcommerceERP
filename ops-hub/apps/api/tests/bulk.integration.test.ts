import { randomUUID } from "node:crypto";

import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { BulkService } from "../src/bulk/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantId = "00000000-0000-4000-8000-00000000e001";
const otherTenantId = "00000000-0000-4000-8000-00000000e002";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const bulk = new BulkService(pool);

async function product(tenant: string, name: string): Promise<string> {
  const id = randomUUID();
  await client.query(
    `insert into products (id, tenant_id, kind, name_ar, name_en, status) values ($1, $2, 'simple', 'منتج', $3, 'draft')`,
    [id, tenant, name],
  );
  return id;
}

async function variant(
  tenant: string,
  productId: string,
  sku: string,
  priceMinor: number | null,
): Promise<string> {
  const id = randomUUID();
  await client.query(
    `insert into variants (id, tenant_id, product_id, sku, price_minor, currency) values ($1, $2, $3, $4, $5, 'EGP')`,
    [id, tenant, productId, sku, priceMinor],
  );
  return id;
}

async function priceOf(variantId: string): Promise<number | null> {
  const result = await client.query<{ price_minor: number | null }>(
    `select price_minor from variants where id = $1`,
    [variantId],
  );
  return result.rows[0]!.price_minor;
}

describe.skipIf(!runDbTests)("Bulk changes against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    for (const id of [tenantId, otherTenantId]) {
      await client.query("delete from variants where tenant_id = $1", [id]);
      await client.query("delete from products where tenant_id = $1", [id]);
      await client.query("delete from tenants where id = $1", [id]);
    }
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'bulk-test', 'Bulk Test')",
      [tenantId],
    );
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'bulk-other', 'Bulk Other')",
      [otherTenantId],
    );
  });

  afterAll(async () => {
    await client.end();
    await pool.end();
  });

  it("sets the status of many products and reports a missing one without failing the rest", async () => {
    const a = await product(tenantId, "A");
    const b = await product(tenantId, "B");
    const missing = randomUUID();

    const result = await bulk.setProductStatus(
      tenantId,
      [a, b, missing],
      "active",
    );

    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.items.find((item) => item.id === missing)?.outcome).toBe(
      "not-found",
    );
    const rows = await client.query<{ status: string }>(
      `select status from products where tenant_id = $1 and id = any($2::uuid[])`,
      [tenantId, [a, b]],
    );
    expect(rows.rows.every((row) => row.status === "active")).toBe(true);
  });

  it("never changes products that belong to another tenant", async () => {
    const theirs = await product(otherTenantId, "Theirs");
    const result = await bulk.setProductStatus(tenantId, [theirs], "archived");
    expect(result.items[0]!.outcome).toBe("not-found");
    const row = await client.query<{ status: string }>(
      `select status from products where id = $1`,
      [theirs],
    );
    expect(row.rows[0]!.status).toBe("draft");
  });

  it("applies a percentage increase, rounding to the nearest piaster, and leaves unpriced variants alone", async () => {
    const p = await product(tenantId, "Pct");
    const priced = await variant(tenantId, p, "PCT-1", 999);
    const unpriced = await variant(tenantId, p, "PCT-2", null);

    const result = await bulk.changeProductPrices(tenantId, [p], {
      mode: "percent",
      value: 5,
    });

    expect(result.items[0]).toMatchObject({ outcome: "ok", changed: 1 });
    expect(await priceOf(priced)).toBe(1049);
    expect(await priceOf(unpriced)).toBeNull();
  });

  it("never takes a price below zero when the cut is large", async () => {
    const p = await product(tenantId, "Floor");
    const v = await variant(tenantId, p, "FLOOR-1", 10);
    await bulk.changeProductPrices(tenantId, [p], {
      mode: "percent",
      value: -90,
    });
    expect(await priceOf(v)).toBe(1);
  });

  it("sets a fixed price in minor units", async () => {
    const p = await product(tenantId, "Fixed");
    const v1 = await variant(tenantId, p, "FIX-1", 1000);
    const v2 = await variant(tenantId, p, "FIX-2", 2000);
    const result = await bulk.changeProductPrices(tenantId, [p], {
      mode: "set",
      value: 500,
    });
    expect(result.items[0]).toMatchObject({ outcome: "ok", changed: 2 });
    expect(await priceOf(v1)).toBe(500);
    expect(await priceOf(v2)).toBe(500);
  });

  it("skips a product with no priced variants instead of pricing it at zero", async () => {
    const p = await product(tenantId, "NoPrice");
    const v = await variant(tenantId, p, "NOP-1", null);
    const result = await bulk.changeProductPrices(tenantId, [p], {
      mode: "set",
      value: 100,
    });
    expect(result.items[0]).toMatchObject({ outcome: "skipped", changed: 0 });
    expect(result.skipped).toBe(1);
    expect(await priceOf(v)).toBeNull();
  });

  it("reports a product from another tenant as not found and changes none of its prices", async () => {
    const theirs = await product(otherTenantId, "TheirPrice");
    const v = await variant(otherTenantId, theirs, "TP-1", 700);
    const result = await bulk.changeProductPrices(tenantId, [theirs], {
      mode: "set",
      value: 1,
    });
    expect(result.items[0]!.outcome).toBe("not-found");
    expect(await priceOf(v)).toBe(700);
  });
});
