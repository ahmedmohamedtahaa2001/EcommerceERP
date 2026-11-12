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
  InvalidOrderTransitionError,
  OrderLifecycleService,
} from "../src/orders/lifecycle-service";
import { OrderValidationError } from "../src/orders/errors";
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
const tenantA = "00000000-0000-4000-8000-000000001203";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
let redis: Redis;
let orderService: OrderService;
let validationService: OrderValidationService;
let lifecycle: OrderLifecycleService;
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

describe.skipIf(!runDbTests)("Order lifecycle against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    await cleanup();
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'order-lifecycle-a', 'Order Lifecycle A')",
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
       values ($1, (select id from variants where tenant_id = $1 and sku = $2), $3, 'on_hand', 20)`,
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
      clock: systemClock,
    });
    lifecycle = new OrderLifecycleService({
      store: orderStore,
      stock: reservations,
    });
  });

  afterAll(async () => {
    await cleanup();
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.end();
    await pool.end();
    redis.disconnect();
  });

  async function createOrder() {
    const { result } = await orderService.createOrder(tenantA, randomUUID(), {
      customer: { phone: "01012345678" },
      address: { line1: "1 Test St", governorate: "Giza" },
      lines: [{ sku, quantity: 2, unitPriceMinor: 1000, currency: "EGP" }],
      payment: { method: "cod" },
    });
    return result.order.id;
  }

  async function reservedBalance(): Promise<number> {
    const r = await client.query<{ quantity: number }>(
      `select quantity from stock_balances
          where tenant_id = $1 and location_id = $2 and bucket = 'reserved'`,
      [tenantA, locationId],
    );
    return r.rows[0]?.quantity ?? 0;
  }

  async function status(orderId: string): Promise<string> {
    const r = await client.query<{ status: string }>(
      `select status from orders where id = $1`,
      [orderId],
    );
    return r.rows[0]!.status;
  }

  it("confirms a validated order and cancelling it gives the reserved stock back", async () => {
    const orderId = await createOrder();
    const before = await reservedBalance();
    await validationService.validate(tenantA, orderId, locationId, null);
    expect(await reservedBalance()).toBe(before + 2);

    const confirmed = await lifecycle.transition(
      tenantA,
      orderId,
      "confirmed",
      null,
    );
    expect(confirmed).toMatchObject({
      from: "validated",
      to: "confirmed",
      releasedReservations: 0,
    });

    const cancelled = await lifecycle.transition(
      tenantA,
      orderId,
      "cancelled",
      null,
      "Customer asked to cancel",
    );
    expect(cancelled.releasedReservations).toBe(1);
    expect(await status(orderId)).toBe("cancelled");
    expect(await reservedBalance()).toBe(before);

    const event = await client.query<{
      to_status: string;
      note: string | null;
    }>(
      `select to_status, note from order_events where order_id = $1 order by created_at desc limit 1`,
      [orderId],
    );
    expect(event.rows[0]).toEqual({
      to_status: "cancelled",
      note: "Customer asked to cancel",
    });
  });

  it("refuses a move the state machine does not allow", async () => {
    const orderId = await createOrder();
    await expect(
      lifecycle.transition(tenantA, orderId, "delivered", null),
    ).rejects.toBeInstanceOf(InvalidOrderTransitionError);
    expect(await status(orderId)).toBe("pending");
  });

  it("sends validation through its own action and rejects unknown statuses", async () => {
    const orderId = await createOrder();
    await expect(
      lifecycle.transition(tenantA, orderId, "validated", null),
    ).rejects.toBeInstanceOf(OrderValidationError);
    await expect(
      lifecycle.transition(tenantA, orderId, "teleported", null),
    ).rejects.toBeInstanceOf(OrderValidationError);
  });

  it("walks an order all the way to closed", async () => {
    const orderId = await createOrder();
    await validationService.validate(tenantA, orderId, locationId, null);
    for (const to of [
      "confirmed",
      "allocated",
      "label_created",
      "shipped",
      "out_for_delivery",
      "delivered",
      "closed",
    ]) {
      await lifecycle.transition(tenantA, orderId, to, null);
    }
    expect(await status(orderId)).toBe("closed");
  });

  it("takes shipped units off on-hand and out of reserved", async () => {
    const onHand = async () =>
      (
        await client.query<{ quantity: number }>(
          `select quantity from stock_balances where tenant_id = $1 and location_id = $2 and bucket = 'on_hand'`,
          [tenantA, locationId],
        )
      ).rows[0]!.quantity;
    const orderId = await createOrder();
    const onHandBefore = await onHand();
    const reservedBefore = await reservedBalance();
    await validationService.validate(tenantA, orderId, locationId, null);
    for (const to of ["confirmed", "allocated", "label_created"]) {
      await lifecycle.transition(tenantA, orderId, to, null);
    }
    const shipped = await lifecycle.transition(
      tenantA,
      orderId,
      "shipped",
      null,
    );
    expect(shipped.shippedReservations).toBe(1);
    expect(await onHand()).toBe(onHandBefore - 2);
    expect(await reservedBalance()).toBe(reservedBefore);
  });
});
