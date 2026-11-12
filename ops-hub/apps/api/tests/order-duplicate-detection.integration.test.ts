import { randomUUID } from "node:crypto";

import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgVariantStore } from "../src/catalog/pg-store";
import { DuplicateDetectionService } from "../src/orders/duplicate-detection-service";
import {
  ExceptionAlreadyResolvedError,
  NotADuplicateExceptionError,
} from "../src/orders/duplicate-errors";
import { PgExceptionStore } from "../src/orders/pg-exception-store";
import { PgOrderStore } from "../src/orders/pg-store";
import { OrderService } from "../src/orders/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000001301";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
let orderStore: PgOrderStore;
let exceptionStore: PgExceptionStore;
let duplicateDetection: DuplicateDetectionService;
let orderServiceWithDetection: OrderService;
let sku: string;
let sku2: string;

async function cleanup() {
  await client.query("delete from exceptions where tenant_id = $1", [tenantA]);
  await client.query("delete from order_lines where tenant_id = $1", [tenantA]);
  await client.query("delete from payments where tenant_id = $1", [tenantA]);
  await client.query("delete from orders where tenant_id = $1", [tenantA]);
  await client.query("delete from order_number_counters where tenant_id = $1", [
    tenantA,
  ]);
  await client.query("delete from addresses where tenant_id = $1", [tenantA]);
  await client.query("delete from customers where tenant_id = $1", [tenantA]);
  await client.query("delete from variants where tenant_id = $1", [tenantA]);
  await client.query("delete from products where tenant_id = $1", [tenantA]);
}

describe.skipIf(!runDbTests)(
  "Order duplicate detection against Postgres",
  () => {
    beforeAll(async () => {
      await client.connect();
      await cleanup();
      await client.query("delete from tenants where id = $1", [tenantA]);
      await client.query(
        "insert into tenants (id, slug, name) values ($1, 'dup-detect-a', 'Dup Detect A')",
        [tenantA],
      );

      const productId = randomUUID();
      await client.query(
        `insert into products (id, tenant_id, kind, name_ar, name_en)
       values ($1, $2, 'simple', 'منتج', 'Product')`,
        [productId, tenantA],
      );
      sku = "DUP-A-" + Date.now();
      sku2 = "DUP-B-" + Date.now();
      await client.query(
        `insert into variants (id, tenant_id, product_id, sku) values ($1, $2, $3, $4), ($5, $2, $3, $6)`,
        [randomUUID(), tenantA, productId, sku, randomUUID(), sku2],
      );

      orderStore = new PgOrderStore(pool);
      exceptionStore = new PgExceptionStore(pool);
      duplicateDetection = new DuplicateDetectionService(
        orderStore,
        exceptionStore,
      );
      orderServiceWithDetection = new OrderService({
        store: orderStore,
        variants: new PgVariantStore(pool),
        duplicateDetection,
      });
    });

    afterAll(async () => {
      await cleanup();
      await client.query("delete from tenants where id = $1", [tenantA]);
      await client.end();
      await pool.end();
    });

    async function placeOrder(overrides: Record<string, unknown> = {}) {
      const { result, duplicate } = await orderServiceWithDetection.createOrder(
        tenantA,
        randomUUID(),
        {
          customer: { phone: "01012345678" },
          address: { line1: "1 Test St", governorate: "Giza" },
          lines: [{ sku, quantity: 1, unitPriceMinor: 1000, currency: "EGP" }],
          payment: { method: "cod" },
          ...overrides,
        },
      );
      return { result, duplicate };
    }

    it("flags a second order with the same phone and same SKU set as a suspected duplicate", async () => {
      const first = await placeOrder();
      expect(first.duplicate).toBeNull();

      const second = await placeOrder();
      expect(second.duplicate).not.toBeNull();
      expect(second.duplicate?.duplicateOfOrderId).toBe(first.result.order.id);
      expect(second.duplicate?.matchType).toBe("sku_set");

      // Both orders exist — never auto-merged.
      const countResult = await client.query<{ count: string }>(
        "select count(*) from orders where tenant_id = $1 and customer_id = $2",
        [tenantA, first.result.order.customerId],
      );
      expect(Number(countResult.rows[0]?.count)).toBe(2);

      const exceptionRow = await client.query<{
        reason_code: string;
        status: string;
      }>("select reason_code, status from exceptions where id = $1", [
        second.duplicate!.exceptionId,
      ]);
      expect(exceptionRow.rows[0]).toMatchObject({
        reason_code: "DUPLICATE_SUSPECTED",
        status: "open",
      });
    });

    it("does NOT flag an order with a different SKU set for the same customer", async () => {
      await placeOrder({ customer: { phone: "01099988877" } });
      const different = await placeOrder({
        customer: { phone: "01099988877" },
        lines: [
          { sku: sku2, quantity: 1, unitPriceMinor: 1000, currency: "EGP" },
        ],
      });
      expect(different.duplicate).toBeNull();
    });

    it("flags a duplicate by matching external_order_id + channel even with different lines", async () => {
      const first = await placeOrder({
        customer: { phone: "01077788899" },
        channel: "shopify",
        externalOrderId: "SHOPIFY-1001",
      });
      const second = await placeOrder({
        customer: { phone: "01077788899" },
        channel: "shopify",
        externalOrderId: "SHOPIFY-1001",
        lines: [
          { sku: sku2, quantity: 1, unitPriceMinor: 1000, currency: "EGP" },
        ],
      });

      expect(second.duplicate?.matchType).toBe("external_order_id");
      expect(second.duplicate?.duplicateOfOrderId).toBe(first.result.order.id);
    });

    it("review: accept keeps both orders and just resolves the exception", async () => {
      const first = await placeOrder({ customer: { phone: "01066655544" } });
      const second = await placeOrder({ customer: { phone: "01066655544" } });
      const exceptionId = second.duplicate!.exceptionId;

      const review = await duplicateDetection.review(
        tenantA,
        exceptionId,
        "accept",
      );
      expect(review).toEqual({ action: "accept", cancelledOrderId: null });

      const orderStatus = await client.query<{ status: string }>(
        "select status from orders where id = $1",
        [second.result.order.id],
      );
      expect(orderStatus.rows[0]?.status).toBe("pending");

      const exceptionRow = await client.query<{ status: string }>(
        "select status from exceptions where id = $1",
        [exceptionId],
      );
      expect(exceptionRow.rows[0]?.status).toBe("resolved");
      void first;
    });

    it("review: merge cancels the flagged (newer) order", async () => {
      await placeOrder({ customer: { phone: "01055544433" } });
      const second = await placeOrder({ customer: { phone: "01055544433" } });
      const exceptionId = second.duplicate!.exceptionId;

      const review = await duplicateDetection.review(
        tenantA,
        exceptionId,
        "merge",
      );
      expect(review).toEqual({
        action: "merge",
        cancelledOrderId: second.result.order.id,
      });

      const orderStatus = await client.query<{ status: string }>(
        "select status from orders where id = $1",
        [second.result.order.id],
      );
      expect(orderStatus.rows[0]?.status).toBe("cancelled");
    });

    it("review: rejects reviewing the same exception twice", async () => {
      await placeOrder({ customer: { phone: "01044433322" } });
      const second = await placeOrder({ customer: { phone: "01044433322" } });
      const exceptionId = second.duplicate!.exceptionId;

      await duplicateDetection.review(tenantA, exceptionId, "accept");
      await expect(
        duplicateDetection.review(tenantA, exceptionId, "accept"),
      ).rejects.toThrow(ExceptionAlreadyResolvedError);
    });

    it("review: rejects reviewing a non-duplicate exception as a duplicate", async () => {
      const exception = await exceptionStore.create(
        tenantA,
        (await placeOrder({ customer: { phone: "01033322211" } })).result.order
          .id,
        "ADDRESS_INCOMPLETE",
      );

      await expect(
        duplicateDetection.review(tenantA, exception.id, "accept"),
      ).rejects.toThrow(NotADuplicateExceptionError);
    });
  },
);
