import { randomUUID } from "node:crypto";

import { systemClock } from "@ops-hub/shared";
import Redis from "ioredis";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgVariantStore } from "../src/catalog/pg-store";
import { PgExceptionStore } from "../src/orders/pg-exception-store";
import { PgOrderStore } from "../src/orders/pg-store";
import { OrderService } from "../src/orders/service";
import { OrderValidationService } from "../src/orders/validation-service";
import {
  PgReservationBalanceReader,
  PgReservationStore,
} from "../src/stock/pg-reservation-store";
import { PgStockStore } from "../src/stock/pg-store";
import { RedisLock } from "../src/stock/redis-lock";
import { ReservationService } from "../src/stock/reservation-service";
import { StockService } from "../src/stock/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000001201";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
let redis: Redis;
let orderService: OrderService;
let validationService: OrderValidationService;
let locationId: string;
let sku: string;

async function cleanup() {
  await client.query("delete from exceptions where tenant_id = $1", [tenantA]);
  await client.query("delete from stock_reservations where tenant_id = $1", [
    tenantA,
  ]);
  await client.query("delete from stock_movements where tenant_id = $1", [
    tenantA,
  ]);
  await client.query("delete from stock_balances where tenant_id = $1", [
    tenantA,
  ]);
  await client.query("delete from order_lines where tenant_id = $1", [tenantA]);
  await client.query("delete from payments where tenant_id = $1", [tenantA]);
  await client.query("delete from orders where tenant_id = $1", [tenantA]);
  await client.query("delete from order_number_counters where tenant_id = $1", [
    tenantA,
  ]);
  await client.query("delete from addresses where tenant_id = $1", [tenantA]);
  await client.query("delete from customers where tenant_id = $1", [tenantA]);
  await client.query("delete from locations where tenant_id = $1", [tenantA]);
  await client.query("delete from variants where tenant_id = $1", [tenantA]);
  await client.query("delete from products where tenant_id = $1", [tenantA]);
}

describe.skipIf(!runDbTests)(
  "Order validation pipeline against Postgres",
  () => {
    beforeAll(async () => {
      await client.connect();
      redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
      await cleanup();
      await client.query("delete from tenants where id = $1", [tenantA]);
      await client.query(
        "insert into tenants (id, slug, name) values ($1, 'order-validation-a', 'Order Validation A')",
        [tenantA],
      );

      const productId = randomUUID();
      await client.query(
        `insert into products (id, tenant_id, kind, name_ar, name_en)
       values ($1, $2, 'simple', 'منتج', 'Product')`,
        [productId, tenantA],
      );
      sku = "VALIDATE-" + Date.now();
      await client.query(
        `insert into variants (id, tenant_id, product_id, sku) values ($1, $2, $3, $4)`,
        [randomUUID(), tenantA, productId, sku],
      );
      locationId = randomUUID();
      await client.query(
        `insert into locations (id, tenant_id, type, name) values ($1, $2, 'warehouse', 'Validation WH')`,
        [locationId, tenantA],
      );
      await client.query(
        `insert into stock_balances (tenant_id, variant_id, location_id, bucket, quantity)
       values ($1, (select id from variants where tenant_id = $1 and sku = $2), $3, 'on_hand', 5)`,
        [tenantA, sku, locationId],
      );

      const stockStore = new PgStockStore(pool);
      const stock = new StockService({ store: stockStore, clock: systemClock });
      const reservations = new ReservationService({
        store: new PgReservationStore(pool),
        balances: new PgReservationBalanceReader(pool),
        movements: stock,
        lock: new RedisLock(redis),
        clock: systemClock,
      });
      const orderStore = new PgOrderStore(pool);
      orderService = new OrderService({
        store: orderStore,
        variants: new PgVariantStore(pool),
      });
      validationService = new OrderValidationService({
        store: orderStore,
        exceptions: new PgExceptionStore(pool),
        variants: new PgVariantStore(pool),
        reservations,
      });
    });

    afterAll(async () => {
      await cleanup();
      await client.query("delete from tenants where id = $1", [tenantA]);
      await client.end();
      await pool.end();
      redis.disconnect();
    });

    async function createOrder(overrides: Record<string, unknown> = {}) {
      const { result } = await orderService.createOrder(tenantA, randomUUID(), {
        customer: { phone: "01012345678" },
        address: { line1: "1 Test St", governorate: "Giza" },
        lines: [{ sku, quantity: 2, unitPriceMinor: 1000, currency: "EGP" }],
        payment: { method: "cod" },
        ...overrides,
      });
      return result;
    }

    it("validates a clean order: status -> validated, no exception", async () => {
      const order = await createOrder();
      const result = await validationService.validate(
        tenantA,
        order.order.id,
        locationId,
        null,
      );

      expect(result).toEqual({
        status: "validated",
        reasonCode: null,
        exceptionId: null,
      });

      const stored = await client.query<{ status: string }>(
        "select status from orders where id = $1",
        [order.order.id],
      );
      expect(stored.rows[0]?.status).toBe("validated");

      // Stock was actually reserved, not just checked.
      const reservationCount = await client.query<{ count: string }>(
        "select count(*) from stock_reservations where tenant_id = $1 and status = 'active'",
        [tenantA],
      );
      expect(Number(reservationCount.rows[0]?.count)).toBeGreaterThanOrEqual(1);
    });

    it("ADDRESS_INCOMPLETE: unresolvable governorate holds the order with an exception", async () => {
      const order = await createOrder({
        address: { line1: "1 Test St", governorate: "Nowhereland" },
      });
      const result = await validationService.validate(
        tenantA,
        order.order.id,
        locationId,
        null,
      );

      expect(result.status).toBe("on_hold");
      expect(result.reasonCode).toBe("ADDRESS_INCOMPLETE");
      expect(result.exceptionId).not.toBeNull();

      const exceptionRow = await client.query<{ reason_code: string }>(
        "select reason_code from exceptions where id = $1",
        [result.exceptionId],
      );
      expect(exceptionRow.rows[0]?.reason_code).toBe("ADDRESS_INCOMPLETE");
    });

    it("INSUFFICIENT_STOCK: requesting more than available holds the order and releases any partial reservation", async () => {
      const order = await createOrder({
        lines: [{ sku, quantity: 999, unitPriceMinor: 1000, currency: "EGP" }],
      });
      const result = await validationService.validate(
        tenantA,
        order.order.id,
        locationId,
        null,
      );

      expect(result.status).toBe("on_hold");
      expect(result.reasonCode).toBe("INSUFFICIENT_STOCK");

      const activeReservations = await client.query<{ count: string }>(
        `select count(*) from stock_reservations
        where tenant_id = $1 and status = 'active'
          and quantity = 999`,
        [tenantA],
      );
      expect(Number(activeReservations.rows[0]?.count)).toBe(0);
    });

    it("validating an already on_hold order moves it back to validated when the problem is fixed", async () => {
      const order = await createOrder({
        lines: [{ sku, quantity: 999, unitPriceMinor: 1000, currency: "EGP" }],
      });
      const first = await validationService.validate(
        tenantA,
        order.order.id,
        locationId,
        null,
      );
      expect(first.status).toBe("on_hold");

      await client.query(
        `update order_lines set quantity = 1 where order_id = $1`,
        [order.order.id],
      );
      const second = await validationService.validate(
        tenantA,
        order.order.id,
        locationId,
        null,
      );
      expect(second.status).toBe("validated");
    });
  },
);
