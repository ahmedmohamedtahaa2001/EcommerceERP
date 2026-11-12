import { keysetClause } from "../platform/service";
import { randomUUID } from "node:crypto";

import { withTenant } from "@ops-hub/db";
import type { Pool, PoolClient } from "pg";

import { InsufficientStockError } from "./errors";
import type {
  MovementWithBalance,
  StockBalanceRecord,
  StockBucket,
  StockMovementRecord,
  StockStore,
  StockTransferInput,
  StockTransferResult,
} from "./types";

interface MovementRow {
  id: string;
  tenant_id: string;
  variant_id: string;
  location_id: string | null;
  bucket: string;
  delta: number;
  reason: string;
  reference: string | null;
  actor_type: string | null;
  actor_id: string | null;
  created_at: Date;
}

interface BalanceRow {
  id: string;
  tenant_id: string;
  variant_id: string;
  location_id: string;
  bucket: string;
  quantity: number;
  updated_at: Date;
}

function toMovement(row: MovementRow): StockMovementRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    variantId: row.variant_id,
    locationId: row.location_id,
    bucket: row.bucket as StockBucket,
    delta: row.delta,
    reason: row.reason,
    reference: row.reference,
    actorType: row.actor_type,
    actorId: row.actor_id,
    createdAt: row.created_at,
  };
}

function toBalance(row: BalanceRow): StockBalanceRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    variantId: row.variant_id,
    locationId: row.location_id,
    bucket: row.bucket as StockBucket,
    quantity: row.quantity,
    updatedAt: row.updated_at,
  };
}

async function writeMovement(
  client: PoolClient,
  record: StockMovementRecord,
): Promise<MovementWithBalance> {
  const movementResult = await client.query<MovementRow>(
    `insert into stock_movements
       (id, tenant_id, variant_id, location_id, bucket, delta, reason,
        reference, actor_type, actor_id, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning *`,
    [
      record.id,
      record.tenantId,
      record.variantId,
      record.locationId,
      record.bucket,
      record.delta,
      record.reason,
      record.reference,
      record.actorType,
      record.actorId,
      record.createdAt,
    ],
  );

  // `stock_balances` is purely derived: this upsert is the only place
  // any code writes to it, and it always happens in the same
  // transaction as the movement that caused it.
  const balanceResult = await client.query<BalanceRow>(
    `insert into stock_balances
       (id, tenant_id, variant_id, location_id, bucket, quantity, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (variant_id, location_id, bucket)
     do update set
       quantity = stock_balances.quantity + excluded.quantity,
       updated_at = excluded.updated_at
     returning *`,
    [
      randomUUID(),
      record.tenantId,
      record.variantId,
      record.locationId,
      record.bucket,
      record.delta,
      record.createdAt,
    ],
  );

  const movementRow = movementResult.rows[0];
  const balanceRow = balanceResult.rows[0];
  if (!movementRow || !balanceRow) {
    throw new Error("stock movement insert returned no row");
  }
  return {
    movement: toMovement(movementRow),
    balance: toBalance(balanceRow),
  };
}

export class PgStockStore implements StockStore {
  constructor(private readonly pool: Pool) {}

  async recordMovement(
    record: StockMovementRecord,
  ): Promise<MovementWithBalance> {
    return withTenant(this.pool, record.tenantId, (client) =>
      writeMovement(client, record),
    );
  }

  async transfer(input: StockTransferInput): Promise<StockTransferResult> {
    return withTenant(this.pool, input.tenantId, async (client) => {
      const locked = await client.query<{ bucket: string; quantity: number }>(
        `select bucket, quantity from stock_balances
          where tenant_id = $1 and variant_id = $2 and location_id = $3
            and bucket in ('on_hand', 'reserved', 'quarantined', 'damaged')
          for update`,
        [input.tenantId, input.variantId, input.fromLocationId],
      );
      const byBucket = new Map(locked.rows.map((r) => [r.bucket, r.quantity]));
      const available =
        (byBucket.get("on_hand") ?? 0) -
        (byBucket.get("reserved") ?? 0) -
        (byBucket.get("quarantined") ?? 0) -
        (byBucket.get("damaged") ?? 0);
      if (!input.allowNegative && available < input.quantity) {
        throw new InsufficientStockError(available, input.quantity);
      }

      const outbound = await writeMovement(client, {
        id: randomUUID(),
        tenantId: input.tenantId,
        variantId: input.variantId,
        locationId: input.fromLocationId,
        bucket: "on_hand",
        delta: -input.quantity,
        reason: `Transfer out: ${input.reason}`,
        reference: input.transferId,
        actorType: input.actor?.type ?? null,
        actorId: input.actor?.id ?? null,
        createdAt: input.createdAt,
      });
      const inbound = await writeMovement(client, {
        id: randomUUID(),
        tenantId: input.tenantId,
        variantId: input.variantId,
        locationId: input.toLocationId,
        bucket: "on_hand",
        delta: input.quantity,
        reason: `Transfer in: ${input.reason}`,
        reference: input.transferId,
        actorType: input.actor?.type ?? null,
        actorId: input.actor?.id ?? null,
        createdAt: input.createdAt,
      });
      return { transferId: input.transferId, outbound, inbound };
    });
  }

  async listMovements(
    tenantId: string,
    filter: {
      variantId?: string;
      locationId?: string;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<StockMovementRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.variantId !== undefined) {
        params.push(filter.variantId);
        conditions.push(`variant_id = $${params.length}`);
      }
      if (filter.locationId !== undefined) {
        params.push(filter.locationId);
        conditions.push(`location_id = $${params.length}`);
      }
      const limitClause = keysetClause(
        {
          limit: filter.limit,
          cursor: filter.cursor ?? null,
        },
        conditions,
        params,
        "created_at",
        "uuid",
        "asc",
      );
      const result = await client.query<
        MovementRow & { sku: string | null; actor_name: string | null }
      >(
        `select m.*,
                (select v.sku from variants v where v.id = m.variant_id) as sku,
                (select coalesce(u.full_name, u.email) from users u
                  where m.actor_type = 'user' and u.id = m.actor_id) as actor_name
           from stock_movements m
          where ${conditions.join(" and ")}
          order by created_at asc, id asc${limitClause}`,
        params,
      );
      return result.rows.map((row) => ({
        ...toMovement(row),
        sku: row.sku,
        actorName: row.actor_name,
      }));
    });
  }

  async listBalances(
    tenantId: string,
    filter: {
      variantId?: string;
      locationId?: string;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<StockBalanceRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.variantId !== undefined) {
        params.push(filter.variantId);
        conditions.push(`variant_id = $${params.length}`);
      }
      if (filter.locationId !== undefined) {
        params.push(filter.locationId);
        conditions.push(`location_id = $${params.length}`);
      }
      const limitClause = keysetClause(
        { limit: filter.limit, cursor: filter.cursor ?? null },
        conditions,
        params,
        "updated_at",
      );
      const result = await client.query<
        BalanceRow & {
          sku: string | null;
          name_ar: string | null;
          name_en: string | null;
        }
      >(
        `select b.*,
                (select v.sku from variants v where v.id = b.variant_id) as sku,
                (select p.name_ar from variants v join products p on p.id = v.product_id
                  where v.id = b.variant_id) as name_ar,
                (select p.name_en from variants v join products p on p.id = v.product_id
                  where v.id = b.variant_id) as name_en
           from stock_balances b
          where ${conditions.join(" and ")}
          order by updated_at desc, id desc${limitClause}`,
        params,
      );
      return result.rows.map((row) => ({
        ...toBalance(row),
        sku: row.sku,
        productNameAr: row.name_ar,
        productNameEn: row.name_en,
      }));
    });
  }
}
