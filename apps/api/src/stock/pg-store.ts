import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type {
  Bucket,
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

function toMovement(row: MovementRow): StockMovementRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    variantId: row.variant_id,
    locationId: row.location_id,
    bucket: row.bucket as Bucket,
    delta: row.delta,
    reason: row.reason,
    reference: row.reference,
    actorType: row.actor_type,
    actorId: row.actor_id,
    createdAt: row.created_at,
  };
}

export class PgStockStore implements StockStore {
  constructor(private readonly pool: Pool) {}

  async applyMovement(movement: StockMovementRecord): Promise<void> {
    await withTenant(this.pool, movement.tenantId, async (client) => {
      await client.query(
        `insert into stock_movements
           (id, tenant_id, variant_id, location_id, bucket, delta, reason, reference, actor_type, actor_id, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          movement.id,
          movement.tenantId,
          movement.variantId,
          movement.locationId,
          movement.bucket,
          movement.delta,
          movement.reason,
          movement.reference,
          movement.actorType,
          movement.actorId,
          movement.createdAt,
        ],
      );
      await client.query(
        `insert into stock_balances
           (tenant_id, variant_id, location_id, bucket, quantity, updated_at)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (variant_id, location_id, bucket)
         do update set quantity = stock_balances.quantity + $5, updated_at = $6`,
        [
          movement.tenantId,
          movement.variantId,
          movement.locationId,
          movement.bucket,
          movement.delta,
          movement.createdAt,
        ],
      );
    });
  }

  async getBalance(
    tenantId: string,
    variantId: string,
    locationId: string,
    bucket: Bucket,
  ): Promise<number> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<{ quantity: number }>(
        `select quantity from stock_balances
          where tenant_id = $1 and variant_id = $2 and location_id = $3 and bucket = $4`,
        [tenantId, variantId, locationId, bucket],
      );
      return result.rows[0]?.quantity ?? 0;
    });
  }

  async getBalances(
    tenantId: string,
    variantId: string,
    locationId: string,
  ): Promise<Record<Bucket, number>> {
    const result: Record<Bucket, number> = {
      on_hand: 0,
      reserved: 0,
      quarantined: 0,
      damaged: 0,
      in_transit: 0,
    };
    return withTenant(this.pool, tenantId, async (client) => {
      const res = await client.query<{ bucket: string; quantity: number }>(
        `select bucket, quantity from stock_balances
          where tenant_id = $1 and variant_id = $2 and location_id = $3`,
        [tenantId, variantId, locationId],
      );
      for (const row of res.rows) {
        result[row.bucket as Bucket] = row.quantity;
      }
      return result;
    });
  }

  async listLocationsWithBalance(tenantId: string, variantId: string): Promise<string[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const res = await client.query<{ location_id: string }>(
        `select distinct location_id from stock_balances
          where tenant_id = $1 and variant_id = $2`,
        [tenantId, variantId],
      );
      return res.rows.map((r) => r.location_id);
    });
  }

  async listMovements(
    tenantId: string,
    filters: { variantId?: string; locationId?: string },
  ): Promise<StockMovementRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filters.variantId) {
        params.push(filters.variantId);
        conditions.push(`variant_id = $${params.length}`);
      }
      if (filters.locationId) {
        params.push(filters.locationId);
        conditions.push(`location_id = $${params.length}`);
      }
      const result = await client.query<MovementRow>(
        `select * from stock_movements where ${conditions.join(" and ")} order by created_at asc, id asc`,
        params,
      );
      return result.rows.map(toMovement);
    });
  }
}
