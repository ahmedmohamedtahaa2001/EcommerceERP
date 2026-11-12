import { randomUUID } from "node:crypto";

import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  InsufficientStockError,
  StockReferenceNotFoundError,
  StockValidationError,
} from "../src/stock/errors";
import { PgStockStore } from "../src/stock/pg-store";
import { StockService } from "../src/stock/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from every other integration suite (see the tenant-collision fix).
const tenantId = "00000000-0000-4000-8000-000000007701";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });

function serviceWith(allowNegative: boolean): StockService {
  return new StockService({
    store: new PgStockStore(pool),
    clock: systemClock,
    policy: { allowsNegativeStock: async () => allowNegative },
  });
}

async function createLocation(name: string): Promise<string> {
  const id = randomUUID();
  await client.query(
    `insert into locations (id, tenant_id, type, name) values ($1, $2, 'warehouse', $3)`,
    [id, tenantId, name],
  );
  return id;
}

async function createVariant(sku: string): Promise<string> {
  const productId = randomUUID();
  await client.query(
    `insert into products (id, tenant_id, kind, name_ar, name_en)
     values ($1, $2, 'simple', 'منتج', 'Product')`,
    [productId, tenantId],
  );
  const variantId = randomUUID();
  await client.query(
    `insert into variants (id, tenant_id, product_id, sku) values ($1, $2, $3, $4)`,
    [variantId, tenantId, productId, sku],
  );
  return variantId;
}

async function balance(
  variantId: string,
  locationId: string,
  bucket: string,
): Promise<number> {
  const result = await client.query<{ quantity: number }>(
    `select quantity from stock_balances
      where variant_id = $1 and location_id = $2 and bucket = $3`,
    [variantId, locationId, bucket],
  );
  return result.rows[0]?.quantity ?? 0;
}

async function movementCount(variantId: string): Promise<number> {
  const result = await client.query<{ n: string }>(
    `select count(*)::text as n from stock_movements where variant_id = $1`,
    [variantId],
  );
  return Number(result.rows[0]!.n);
}

describe.skipIf(!runDbTests)("Stock transfers against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from stock_movements where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from stock_balances where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from variants where tenant_id = $1", [tenantId]);
    await client.query("delete from products where tenant_id = $1", [tenantId]);
    await client.query("delete from locations where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from tenants where id = $1", [tenantId]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'transfer-test', 'Transfer Test')",
      [tenantId],
    );
  });

  afterAll(async () => {
    await pool.end();
    await client.end();
  });

  async function seed(onHand: number, reserved = 0) {
    const variantId = await createVariant(`TR-${randomUUID().slice(0, 8)}`);
    const from = await createLocation(`From ${randomUUID().slice(0, 6)}`);
    const to = await createLocation(`To ${randomUUID().slice(0, 6)}`);
    const service = serviceWith(false);
    await service.recordMovement(
      {
        variantId,
        locationId: from,
        bucket: "on_hand",
        delta: onHand,
        reason: "OPENING",
      },
      tenantId,
      null,
    );
    if (reserved > 0) {
      await service.recordMovement(
        {
          variantId,
          locationId: from,
          bucket: "reserved",
          delta: reserved,
          reason: "HOLD",
        },
        tenantId,
        null,
      );
    }
    return { variantId, from, to };
  }

  it("moves on-hand stock and records both legs under one transfer reference", async () => {
    const { variantId, from, to } = await seed(10);
    const result = await serviceWith(false).transfer(
      {
        variantId,
        fromLocationId: from,
        toLocationId: to,
        quantity: 4,
        reason: "Restock",
      },
      tenantId,
      null,
    );

    expect(await balance(variantId, from, "on_hand")).toBe(6);
    expect(await balance(variantId, to, "on_hand")).toBe(4);
    expect(result.outbound.movement.delta).toBe(-4);
    expect(result.inbound.movement.delta).toBe(4);
    expect(result.outbound.movement.reference).toBe(result.transferId);
    expect(result.inbound.movement.reference).toBe(result.transferId);
    expect(result.outbound.movement.reason).toBe("Transfer out: Restock");
  });

  it("refuses a transfer larger than the available stock and changes nothing", async () => {
    const { variantId, from, to } = await seed(3);
    const before = await movementCount(variantId);

    await expect(
      serviceWith(false).transfer(
        {
          variantId,
          fromLocationId: from,
          toLocationId: to,
          quantity: 5,
          reason: "Too much",
        },
        tenantId,
        null,
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    expect(await balance(variantId, from, "on_hand")).toBe(3);
    expect(await balance(variantId, to, "on_hand")).toBe(0);
    expect(await movementCount(variantId)).toBe(before);
  });

  it("counts reserved stock as unavailable to transfer", async () => {
    const { variantId, from, to } = await seed(10, 8);

    await expect(
      serviceWith(false).transfer(
        {
          variantId,
          fromLocationId: from,
          toLocationId: to,
          quantity: 5,
          reason: "Blocked",
        },
        tenantId,
        null,
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    await serviceWith(false).transfer(
      {
        variantId,
        fromLocationId: from,
        toLocationId: to,
        quantity: 2,
        reason: "Spare",
      },
      tenantId,
      null,
    );
    expect(await balance(variantId, from, "on_hand")).toBe(8);
    expect(await balance(variantId, to, "on_hand")).toBe(2);
  });

  it("rolls back the outbound leg when the destination location does not exist", async () => {
    const { variantId, from } = await seed(10);
    const before = await movementCount(variantId);

    await expect(
      serviceWith(false).transfer(
        {
          variantId,
          fromLocationId: from,
          toLocationId: randomUUID(),
          quantity: 4,
          reason: "Ghost destination",
        },
        tenantId,
        null,
      ),
    ).rejects.toBeInstanceOf(StockReferenceNotFoundError);

    expect(await balance(variantId, from, "on_hand")).toBe(10);
    expect(await movementCount(variantId)).toBe(before);
  });

  it("allows the move when the tenant permits negative stock", async () => {
    const { variantId, from, to } = await seed(1);
    await serviceWith(true).transfer(
      {
        variantId,
        fromLocationId: from,
        toLocationId: to,
        quantity: 3,
        reason: "Oversell",
      },
      tenantId,
      null,
    );
    expect(await balance(variantId, from, "on_hand")).toBe(-2);
    expect(await balance(variantId, to, "on_hand")).toBe(3);
  });

  it("validates quantity, reason and distinct locations before touching the database", async () => {
    const service = serviceWith(false);
    const base = {
      variantId: randomUUID(),
      fromLocationId: randomUUID(),
      toLocationId: randomUUID(),
      quantity: 1,
      reason: "ok",
    };
    await expect(
      service.transfer({ ...base, quantity: 0 }, tenantId, null),
    ).rejects.toBeInstanceOf(StockValidationError);
    await expect(
      service.transfer(
        { ...base, toLocationId: base.fromLocationId },
        tenantId,
        null,
      ),
    ).rejects.toBeInstanceOf(StockValidationError);
    await expect(
      service.transfer({ ...base, reason: "   " }, tenantId, null),
    ).rejects.toBeInstanceOf(StockValidationError);
  });
});
