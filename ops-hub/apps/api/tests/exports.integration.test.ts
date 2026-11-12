import { randomUUID } from "node:crypto";

import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ExportService } from "../src/exports/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantId = "00000000-0000-4000-8000-00000000d001";
const otherTenantId = "00000000-0000-4000-8000-00000000d002";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const exports = new ExportService(pool, {
  now: () => new Date("2026-11-12T12:00:00Z"),
});

async function resetTenant(id: string, slug: string) {
  await client.query("delete from payments where tenant_id = $1", [id]);
  await client.query("delete from order_lines where tenant_id = $1", [id]);
  await client.query("delete from orders where tenant_id = $1", [id]);
  await client.query("delete from stock_balances where tenant_id = $1", [id]);
  await client.query("delete from variants where tenant_id = $1", [id]);
  await client.query("delete from products where tenant_id = $1", [id]);
  await client.query("delete from addresses where tenant_id = $1", [id]);
  await client.query("delete from customers where tenant_id = $1", [id]);
  await client.query("delete from locations where tenant_id = $1", [id]);
  await client.query("delete from tenants where id = $1", [id]);
  await client.query(
    "insert into tenants (id, slug, name) values ($1, $2, 'Export Test')",
    [id, slug],
  );
}

function lines(csv: string): string[] {
  return csv.split("\r\n").filter((line) => line !== "");
}

describe.skipIf(!runDbTests)("CSV exports against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await resetTenant(tenantId, "exports-test");
    await resetTenant(otherTenantId, "exports-other");

    const productId = randomUUID();
    await client.query(
      `insert into products (id, tenant_id, kind, name_ar, name_en, category, brand, tags, is_hazardous, status)
       values ($1, $2, 'simple', 'قطن', $3, 'Apparel', 'Acme', $4::jsonb, false, 'active')`,
      [
        productId,
        tenantId,
        'Cotton, "Classic" shirt',
        JSON.stringify(["summer", '=HYPERLINK("x")']),
      ],
    );
    const variantId = randomUUID();
    await client.query(
      `insert into variants (id, tenant_id, product_id, sku, barcode, price_minor, currency, weight_grams)
       values ($1, $2, $3, 'EXP-1', '6291041500213', 14900, 'EGP', 250)`,
      [variantId, tenantId, productId],
    );

    const locationId = randomUUID();
    await client.query(
      `insert into locations (id, tenant_id, type, name, code) values ($1, $2, 'warehouse', 'Export WH', 'EXP-WH')`,
      [locationId, tenantId],
    );
    await client.query(
      `insert into stock_balances (tenant_id, variant_id, location_id, bucket, quantity)
       values ($1, $2, $3, 'on_hand', 7)`,
      [tenantId, variantId, locationId],
    );

    const customerId = randomUUID();
    await client.query(
      `insert into customers (id, tenant_id, phone, full_name, email)
       values ($1, $2, '+201000000111', '=evil()', 'buyer@example.com')`,
      [customerId, tenantId],
    );
    const orderId = randomUUID();
    await client.query(
      `insert into orders (id, tenant_id, order_number, customer_id, status, currency, channel, total_minor, subtotal_minor)
       values ($1, $2, 'OP-EXPORT-1', $3, 'pending', 'EGP', 'manual', 14900, 14900)`,
      [orderId, tenantId, customerId],
    );
    await client.query(
      `insert into order_lines (id, tenant_id, order_id, variant_id, sku, quantity, unit_price_minor, currency)
       values ($1, $2, $3, $4, 'EXP-1', 1, 14900, 'EGP')`,
      [randomUUID(), tenantId, orderId, variantId],
    );
    await client.query(
      `insert into payments (id, tenant_id, order_id, method, amount_minor, currency, status)
       values ($1, $2, $3, 'cod', 14900, 'EGP', 'pending')`,
      [randomUUID(), tenantId, orderId],
    );
  });

  afterAll(async () => {
    await client.end();
    await pool.end();
  });

  it("names the file after the resource and the export date", async () => {
    const file = await exports.exportOrders(tenantId);
    expect(file.filename).toBe("orders-2026-11-12.csv");
  });

  it("exports products with quoted commas and neutralized formulas", async () => {
    const file = await exports.exportProducts(tenantId);
    const [header, row] = lines(file.csv);
    expect(header).toBe(
      "sku,name_en,name_ar,kind,status,category,brand,tags,hazardous,barcode,price_minor,currency,weight_grams",
    );
    expect(row).toContain('"Cotton, ""Classic"" shirt"');
    expect(row).toContain('"summer;=HYPERLINK(""x"")"');
    expect(row).toContain(",14900,EGP,250");
    expect(file.rowCount).toBe(1);
  });

  it("exports stock by SKU and location", async () => {
    const file = await exports.exportInventory(tenantId);
    expect(lines(file.csv)).toEqual([
      "sku,location_code,location_name,bucket,quantity",
      "EXP-1,EXP-WH,Export WH,on_hand,7",
    ]);
  });

  it("exports customers with their order count and neutralized names", async () => {
    const file = await exports.exportCustomers(tenantId);
    const [, row] = lines(file.csv);
    expect(row).toContain("'=evil()");
    expect(row).toContain("+201000000111");
    expect(row!.endsWith(",1")).toBe(true);
  });

  it("exports orders with customer, total and payment method", async () => {
    const file = await exports.exportOrders(tenantId);
    const [, row] = lines(file.csv);
    expect(row).toContain("OP-EXPORT-1");
    expect(row).toContain("14900");
    expect(row).toContain(",cod,");
  });

  it("never includes another tenant's rows", async () => {
    const file = await exports.exportCustomers(otherTenantId);
    expect(file.rowCount).toBe(0);
    expect(file.csv).not.toContain("evil");
    expect(file.csv).not.toContain("111");
  });
});
