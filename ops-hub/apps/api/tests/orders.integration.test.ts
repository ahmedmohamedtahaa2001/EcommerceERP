import { randomUUID } from "node:crypto";

import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  IdempotencyConflictError,
  IdempotencyKeyRequiredError,
  UnknownSkuError,
} from "../src/orders/errors";
import { PgOrderStore } from "../src/orders/pg-store";
import { OrderService } from "../src/orders/service";
import { PgVariantStore } from "../src/catalog/pg-store";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000001101";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const service = new OrderService({
  store: new PgOrderStore(pool),
  variants: new PgVariantStore(pool),
});

let sku: string;

function samplePayload(overrides: Record<string, unknown> = {}) {
  return {
    customer: { phone: "01012345678", fullName: "Test Customer" },
    address: { line1: "12 Test St", governorate: "Giza" },
    lines: [{ sku, quantity: 2, unitPriceMinor: 15000, currency: "EGP" }],
    payment: { method: "cod" },
    ...overrides,
  };
}

describe.skipIf(!runDbTests)("Order intake against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from order_lines where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from payments where tenant_id = $1", [tenantA]);
    await client.query("delete from orders where tenant_id = $1", [tenantA]);
    await client.query(
      "delete from order_number_counters where tenant_id = $1",
      [tenantA],
    );
    await client.query("delete from addresses where tenant_id = $1", [tenantA]);
    await client.query("delete from customers where tenant_id = $1", [tenantA]);
    await client.query("delete from variants where tenant_id = $1", [tenantA]);
    await client.query("delete from products where tenant_id = $1", [tenantA]);
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'orders-a', 'Orders Tenant A')",
      [tenantA],
    );

    const productId = randomUUID();
    await client.query(
      `insert into products (id, tenant_id, kind, name_ar, name_en)
       values ($1, $2, 'simple', 'منتج', 'Product')`,
      [productId, tenantA],
    );
    sku = "ORDER-TEST-" + Date.now();
    await client.query(
      `insert into variants (id, tenant_id, product_id, sku) values ($1, $2, $3, $4)`,
      [randomUUID(), tenantA, productId, sku],
    );
  });

  afterAll(async () => {
    await client.query("delete from order_lines where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from payments where tenant_id = $1", [tenantA]);
    await client.query("delete from orders where tenant_id = $1", [tenantA]);
    await client.query(
      "delete from order_number_counters where tenant_id = $1",
      [tenantA],
    );
    await client.query("delete from addresses where tenant_id = $1", [tenantA]);
    await client.query("delete from customers where tenant_id = $1", [tenantA]);
    await client.query("delete from variants where tenant_id = $1", [tenantA]);
    await client.query("delete from products where tenant_id = $1", [tenantA]);
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.end();
    await pool.end();
  });

  it("requires an Idempotency-Key", async () => {
    await expect(
      service.createOrder(tenantA, undefined, samplePayload()),
    ).rejects.toThrow(IdempotencyKeyRequiredError);
  });

  it("rejects an order line referencing an unknown sku", async () => {
    await expect(
      service.createOrder(
        tenantA,
        randomUUID(),
        samplePayload({
          lines: [
            {
              sku: "NOPE-SKU",
              quantity: 1,
              unitPriceMinor: 100,
              currency: "EGP",
            },
          ],
        }),
      ),
    ).rejects.toThrow(UnknownSkuError);
  });

  it("creates an order, assigns an order number, and resolves the governorate", async () => {
    const key = randomUUID();
    const { result, created } = await service.createOrder(
      tenantA,
      key,
      samplePayload(),
    );

    expect(created).toBe(true);
    expect(result.order.orderNumber).toMatch(/^OP-\d+$/);
    expect(result.order.status).toBe("pending");
    expect(result.lines).toHaveLength(1);
    expect(result.payment.amountMinor).toBe(30000);

    const totals = await client.query<{
      subtotal_minor: number;
      total_minor: number;
    }>("select subtotal_minor, total_minor from orders where id = $1", [
      result.order.id,
    ]);
    expect(totals.rows[0]).toEqual({
      subtotal_minor: 30000,
      total_minor: 30000,
    });

    const addressRow = await client.query<{ governorate_code: string | null }>(
      "select governorate_code from addresses where id = $1",
      [result.order.addressId],
    );
    expect(addressRow.rows[0]?.governorate_code).toBe("GIZ");
  });

  it("same key twice returns the same order: 201 then 200 with an identical body", async () => {
    const key = randomUUID();
    const payload = samplePayload();

    const first = await service.createOrder(tenantA, key, payload);
    const second = await service.createOrder(tenantA, key, payload);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.result.order.id).toBe(first.result.order.id);
    expect(second.result).toEqual(first.result);
  });

  it("same key with a different body is rejected", async () => {
    const key = randomUUID();
    await service.createOrder(tenantA, key, samplePayload());

    await expect(
      service.createOrder(
        tenantA,
        key,
        samplePayload({
          lines: [{ sku, quantity: 5, unitPriceMinor: 15000, currency: "EGP" }],
        }),
      ),
    ).rejects.toThrow(IdempotencyConflictError);
  });

  it("maps 01012345678 and +201012345678 to the same customer", async () => {
    const keyA = randomUUID();
    const keyB = randomUUID();

    const first = await service.createOrder(
      tenantA,
      keyA,
      samplePayload({
        customer: { phone: "01099988877", fullName: "Phone Format A" },
      }),
    );
    const second = await service.createOrder(
      tenantA,
      keyB,
      samplePayload({
        customer: { phone: "+201099988877", fullName: "Phone Format B" },
      }),
    );

    expect(first.result.order.customerId).toBe(second.result.order.customerId);

    const customerCount = await client.query<{ count: string }>(
      "select count(*) from customers where tenant_id = $1 and phone = $2",
      [tenantA, "+201099988877"],
    );
    expect(customerCount.rows[0]?.count).toBe("1");
  });
});
