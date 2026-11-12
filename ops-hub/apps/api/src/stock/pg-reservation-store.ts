import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type {
  ReservationBalanceReader,
  ReservationStatus,
  ReservationStore,
  StockReservationRecord,
} from "./reservation-types";

interface ReservationRow {
  id: string;
  tenant_id: string;
  variant_id: string;
  location_id: string;
  quantity: number;
  status: string;
  order_id: string | null;
  expires_at: Date;
  created_at: Date;
  released_at: Date | null;
}

function toRecord(row: ReservationRow): StockReservationRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    variantId: row.variant_id,
    locationId: row.location_id,
    quantity: row.quantity,
    status: row.status as ReservationStatus,
    orderId: row.order_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    releasedAt: row.released_at,
  };
}

export class PgReservationStore implements ReservationStore {
  constructor(private readonly pool: Pool) {}

  async create(record: StockReservationRecord): Promise<void> {
    await withTenant(this.pool, record.tenantId, (client) =>
      client.query(
        `insert into stock_reservations
           (id, tenant_id, variant_id, location_id, quantity, status,
            expires_at, created_at, released_at, order_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          record.id,
          record.tenantId,
          record.variantId,
          record.locationId,
          record.quantity,
          record.status,
          record.expiresAt,
          record.createdAt,
          record.releasedAt,
          record.orderId,
        ],
      ),
    );
  }

  async listActiveByOrder(
    tenantId: string,
    orderId: string,
  ): Promise<StockReservationRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ReservationRow>(
        `select * from stock_reservations
          where tenant_id = $1 and order_id = $2 and status = 'active'`,
        [tenantId, orderId],
      );
      return result.rows.map(toRecord);
    });
  }

  async getById(
    tenantId: string,
    id: string,
  ): Promise<StockReservationRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ReservationRow>(
        `select * from stock_reservations where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toRecord(row) : null;
    });
  }

  async closeActive(
    tenantId: string,
    id: string,
    status: "released" | "expired",
    releasedAt: Date,
  ): Promise<boolean> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `update stock_reservations
            set status = $3, released_at = $4
          where tenant_id = $1 and id = $2 and status = 'active'`,
        [tenantId, id, status, releasedAt],
      );
      return result.rowCount === 1;
    });
  }

  async listExpiredActive(
    tenantId: string,
    asOf: Date,
  ): Promise<StockReservationRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ReservationRow>(
        `select * from stock_reservations
          where tenant_id = $1 and status = 'active' and expires_at <= $2
          order by expires_at asc`,
        [tenantId, asOf],
      );
      return result.rows.map(toRecord);
    });
  }
}

/** Reads the four ATP-relevant buckets directly, for the reservation hot path. */
export class PgReservationBalanceReader implements ReservationBalanceReader {
  constructor(private readonly pool: Pool) {}

  async getBucketQuantities(
    tenantId: string,
    variantId: string,
    locationId: string,
  ): Promise<{
    onHand: number;
    reserved: number;
    quarantined: number;
    damaged: number;
  }> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<{ bucket: string; quantity: number }>(
        `select bucket, quantity from stock_balances
          where tenant_id = $1 and variant_id = $2 and location_id = $3
            and bucket in ('on_hand', 'reserved', 'quarantined', 'damaged')`,
        [tenantId, variantId, locationId],
      );
      const buckets = { onHand: 0, reserved: 0, quarantined: 0, damaged: 0 };
      for (const row of result.rows) {
        if (row.bucket === "on_hand") buckets.onHand = row.quantity;
        else if (row.bucket === "reserved") buckets.reserved = row.quantity;
        else if (row.bucket === "quarantined")
          buckets.quarantined = row.quantity;
        else if (row.bucket === "damaged") buckets.damaged = row.quantity;
      }
      return buckets;
    });
  }
}
