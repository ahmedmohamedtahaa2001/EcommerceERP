import { randomUUID } from "node:crypto";

import { systemClock } from "@ops-hub/shared";
import Redis from "ioredis";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  InsufficientStockError,
  ReservationAlreadyClosedError,
} from "../src/stock/reservation-errors";
import {
  PgReservationBalanceReader,
  PgReservationStore,
} from "../src/stock/pg-reservation-store";
import { RedisLock } from "../src/stock/redis-lock";
import { ReservationService } from "../src/stock/reservation-service";
import { PgStockStore } from "../src/stock/pg-store";
import { StockService } from "../src/stock/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000000801";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
let redis: Redis;
let service: ReservationService;
let stock: StockService;

async function createVariant(sku: string): Promise<string> {
  const productId = randomUUID();
  await client.query(
    `insert into products (id, tenant_id, kind, name_ar, name_en)
     values ($1, $2, 'simple', 'منتج', 'Product')`,
    [productId, tenantA],
  );
  const variantId = randomUUID();
  await client.query(
    `insert into variants (id, tenant_id, product_id, sku) values ($1, $2, $3, $4)`,
    [variantId, tenantA, productId, sku],
  );
  return variantId;
}

async function createLocation(name: string): Promise<string> {
  const locationId = randomUUID();
  await client.query(
    `insert into locations (id, tenant_id, type, name) values ($1, $2, 'warehouse', $3)`,
    [locationId, tenantA, name],
  );
  return locationId;
}

describe.skipIf(!runDbTests)("Reservations against Postgres and Redis", () => {
  beforeAll(async () => {
    await client.connect();
    redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    const stockStore = new PgStockStore(pool);
    stock = new StockService({ store: stockStore, clock: systemClock });
    service = new ReservationService({
      store: new PgReservationStore(pool),
      balances: new PgReservationBalanceReader(pool),
      movements: stock,
      lock: new RedisLock(redis),
      clock: systemClock,
    });

    await client.query("delete from stock_reservations where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from stock_movements where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from stock_balances where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from variants where tenant_id = $1", [tenantA]);
    await client.query("delete from products where tenant_id = $1", [tenantA]);
    await client.query("delete from locations where tenant_id = $1", [tenantA]);
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'resv-a', 'Reservation Tenant A')",
      [tenantA],
    );
  });

  afterAll(async () => {
    await client.query("delete from stock_reservations where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from stock_movements where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from stock_balances where tenant_id = $1", [
      tenantA,
    ]);
    await client.query("delete from variants where tenant_id = $1", [tenantA]);
    await client.query("delete from products where tenant_id = $1", [tenantA]);
    await client.query("delete from locations where tenant_id = $1", [tenantA]);
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.end();
    await pool.end();
    redis.disconnect();
  });

  async function balanceOf(
    variantId: string,
    locationId: string,
    bucket: string,
  ) {
    const result = await client.query<{ quantity: number }>(
      `select quantity from stock_balances
        where tenant_id = $1 and variant_id = $2 and location_id = $3 and bucket = $4`,
      [tenantA, variantId, locationId, bucket],
    );
    return result.rows[0]?.quantity ?? 0;
  }

  it("reserves against available stock and increments the reserved bucket", async () => {
    const variantId = await createVariant("RESV-001");
    const locationId = await createLocation("RESV WH 1");
    await stock.recordMovement(
      {
        variantId,
        locationId,
        bucket: "on_hand",
        delta: 10,
        reason: "RECEIVE",
      },
      tenantA,
      null,
    );

    const reservation = await service.reserve(
      { variantId, locationId, quantity: 4, ttlSeconds: 60 },
      tenantA,
      null,
    );

    expect(reservation.status).toBe("active");
    expect(await balanceOf(variantId, locationId, "reserved")).toBe(4);
  });

  it("rejects a reservation for more than is available", async () => {
    const variantId = await createVariant("RESV-002");
    const locationId = await createLocation("RESV WH 2");
    await stock.recordMovement(
      { variantId, locationId, bucket: "on_hand", delta: 3, reason: "RECEIVE" },
      tenantA,
      null,
    );

    await expect(
      service.reserve(
        { variantId, locationId, quantity: 4, ttlSeconds: 60 },
        tenantA,
        null,
      ),
    ).rejects.toThrow(InsufficientStockError);
  });

  it("releasing a reservation gives the stock back", async () => {
    const variantId = await createVariant("RESV-003");
    const locationId = await createLocation("RESV WH 3");
    await stock.recordMovement(
      {
        variantId,
        locationId,
        bucket: "on_hand",
        delta: 10,
        reason: "RECEIVE",
      },
      tenantA,
      null,
    );
    const reservation = await service.reserve(
      { variantId, locationId, quantity: 5, ttlSeconds: 60 },
      tenantA,
      null,
    );

    await service.release(tenantA, reservation.id, null);

    expect(await balanceOf(variantId, locationId, "reserved")).toBe(0);
    await expect(
      service.release(tenantA, reservation.id, null),
    ).rejects.toThrow(ReservationAlreadyClosedError);
  });

  it("an expired reservation is picked up by expireDue and returns stock to available", async () => {
    const variantId = await createVariant("RESV-004");
    const locationId = await createLocation("RESV WH 4");
    await stock.recordMovement(
      {
        variantId,
        locationId,
        bucket: "on_hand",
        delta: 10,
        reason: "RECEIVE",
      },
      tenantA,
      null,
    );
    await service.reserve(
      { variantId, locationId, quantity: 7, ttlSeconds: 1 },
      tenantA,
      null,
    );
    expect(await balanceOf(variantId, locationId, "reserved")).toBe(7);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    const result = await service.expireDue(tenantA, systemClock.now());

    expect(result.expiredCount).toBeGreaterThanOrEqual(1);
    expect(await balanceOf(variantId, locationId, "reserved")).toBe(0);
  });

  it("exactly one of two concurrent reservations for the last unit succeeds", async () => {
    const variantId = await createVariant("RESV-LAST-UNIT");
    const locationId = await createLocation("RESV WH LAST");
    await stock.recordMovement(
      { variantId, locationId, bucket: "on_hand", delta: 1, reason: "RECEIVE" },
      tenantA,
      null,
    );

    const results = await Promise.allSettled([
      service.reserve(
        { variantId, locationId, quantity: 1, ttlSeconds: 60 },
        tenantA,
        null,
      ),
      service.reserve(
        { variantId, locationId, quantity: 1, ttlSeconds: 60 },
        tenantA,
        null,
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      InsufficientStockError,
    );
    expect(await balanceOf(variantId, locationId, "reserved")).toBe(1);
  });
});
