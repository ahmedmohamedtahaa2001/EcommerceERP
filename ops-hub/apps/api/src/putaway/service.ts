import { withTenant } from "@ops-hub/db";
import type { Pool, PoolClient } from "pg";

import {
  BinCapacityError,
  BinNotFoundError,
  PutawayValidationError,
  UnassignedStockError,
} from "./errors";

export interface BinContentsItem {
  variantId: string;
  sku: string;
  quantity: number;
}

export interface PutawayResult {
  binId: string;
  variantId: string;
  /** Units of this SKU now stored in the bin. */
  binQuantity: number;
  /** Units of this SKU on hand at the location that still have no bin. */
  unassignedAfter: number;
}

interface BinRow {
  location_id: string;
  capacity: number | null;
}

/**
 * Places stock that is already on hand into a bin. Quantities on hand are
 * owned by the stock ledger and do not change here, so this only moves units
 * from "unassigned at the location" into a bin. Every check and write runs in
 * one transaction, with the bin and the location's balance locked, so two
 * concurrent put-aways cannot both claim the same unit.
 */
export class PutawayService {
  constructor(private readonly pool: Pool) {}

  async putAway(
    tenantId: string,
    binId: string,
    input: { variantId: string; quantity: number },
  ): Promise<PutawayResult> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new PutawayValidationError("quantity must be a positive integer.");
    }
    if (typeof input.variantId !== "string" || input.variantId === "") {
      throw new PutawayValidationError("variantId is required.");
    }

    return withTenant(this.pool, tenantId, async (client) => {
      const bin = await lockBin(client, tenantId, binId);
      const onHand = await lockOnHand(
        client,
        tenantId,
        input.variantId,
        bin.location_id,
      );
      const assigned = await sumAssignedAtLocation(
        client,
        tenantId,
        input.variantId,
        bin.location_id,
      );
      const unassigned = onHand - assigned;
      if (input.quantity > unassigned) {
        throw new UnassignedStockError(unassigned, input.quantity);
      }

      if (bin.capacity !== null) {
        const used = await sumBinUsed(client, tenantId, binId);
        const free = bin.capacity - used;
        if (input.quantity > free) {
          throw new BinCapacityError(free, input.quantity);
        }
      }

      const updated = await client.query<{ quantity: number }>(
        `insert into bin_stock (tenant_id, bin_id, variant_id, quantity)
         values ($1, $2, $3, $4)
         on conflict (tenant_id, bin_id, variant_id)
         do update set quantity = bin_stock.quantity + $4, updated_at = now()
         returning quantity`,
        [tenantId, binId, input.variantId, input.quantity],
      );

      return {
        binId,
        variantId: input.variantId,
        binQuantity: updated.rows[0]!.quantity,
        unassignedAfter: unassigned - input.quantity,
      };
    });
  }

  async contents(tenantId: string, binId: string): Promise<BinContentsItem[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const exists = await client.query(
        `select 1 from bins where tenant_id = $1 and id = $2`,
        [tenantId, binId],
      );
      if (exists.rowCount === 0) {
        throw new BinNotFoundError();
      }
      const result = await client.query<{
        variant_id: string;
        sku: string;
        quantity: number;
      }>(
        `select s.variant_id, v.sku, s.quantity
           from bin_stock s
           join variants v on v.id = s.variant_id
          where s.tenant_id = $1 and s.bin_id = $2 and s.quantity > 0
          order by v.sku asc`,
        [tenantId, binId],
      );
      return result.rows.map((row) => ({
        variantId: row.variant_id,
        sku: row.sku,
        quantity: row.quantity,
      }));
    });
  }
}

async function lockBin(
  client: PoolClient,
  tenantId: string,
  binId: string,
): Promise<BinRow> {
  const result = await client.query<BinRow>(
    `select location_id, capacity from bins
      where tenant_id = $1 and id = $2
      for update`,
    [tenantId, binId],
  );
  const row = result.rows[0];
  if (!row) throw new BinNotFoundError();
  return row;
}

async function lockOnHand(
  client: PoolClient,
  tenantId: string,
  variantId: string,
  locationId: string,
): Promise<number> {
  const result = await client.query<{ quantity: number }>(
    `select quantity from stock_balances
      where tenant_id = $1 and variant_id = $2 and location_id = $3
        and bucket = 'on_hand'
      for update`,
    [tenantId, variantId, locationId],
  );
  return result.rows[0]?.quantity ?? 0;
}

async function sumAssignedAtLocation(
  client: PoolClient,
  tenantId: string,
  variantId: string,
  locationId: string,
): Promise<number> {
  const result = await client.query<{ total: number }>(
    `select coalesce(sum(s.quantity), 0)::int as total
       from bin_stock s
       join bins b on b.id = s.bin_id
      where s.tenant_id = $1 and s.variant_id = $2 and b.location_id = $3`,
    [tenantId, variantId, locationId],
  );
  return result.rows[0]!.total;
}

async function sumBinUsed(
  client: PoolClient,
  tenantId: string,
  binId: string,
): Promise<number> {
  const result = await client.query<{ total: number }>(
    `select coalesce(sum(quantity), 0)::int as total
       from bin_stock where tenant_id = $1 and bin_id = $2`,
    [tenantId, binId],
  );
  return result.rows[0]!.total;
}
