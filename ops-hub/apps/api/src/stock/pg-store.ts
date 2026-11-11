import { randomUUID } from "node:crypto";

import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type {
  StockBalanceRecord,
  StockBucket,
  StockMovementRecord,
  StockStore,
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

export class PgStockStore implements StockStore {
  constructor(private readonly pool: Pool) {}

  async recordMovement(
    record: StockMovementRecord,
  ): Promise<{ movement: StockMovementRecord; balance: StockBalanceRecord }> {
    return withTenant(this.pool, record.tenantId, async (client) => {
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
    });
  }

  async listMovements(
    tenantId: string,
    filter: { variantId?: string; locationId?: string },
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
      const result = await client.query<MovementRow>(
        `select * from stock_movements where ${conditions.join(" and ")}
          order by created_at asc, id asc`,
        params,
      );
      return result.rows.map(toMovement);
    });
  }

  async listBalances(
    tenantId: string,
    filter: { variantId?: string; locationId?: string },
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
      const result = await client.query<BalanceRow>(
        `select * from stock_balances where ${conditions.join(" and ")}
          order by variant_id asc, location_id asc, bucket asc`,
        params,
      );
      return result.rows.map(toBalance);
    });
  }
}
