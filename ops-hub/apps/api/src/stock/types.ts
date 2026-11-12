import type { TenantStockPolicyReader } from "../availability/types";

export const STOCK_BUCKETS = [
  "on_hand",
  "reserved",
  "quarantined",
  "damaged",
  "in_transit",
] as const;
export type StockBucket = (typeof STOCK_BUCKETS)[number];

export interface StockMovementRecord {
  id: string;
  tenantId: string;
  variantId: string;
  locationId: string | null;
  bucket: StockBucket;
  delta: number;
  reason: string;
  reference: string | null;
  actorType: string | null;
  actorId: string | null;
  createdAt: Date;
}

export interface StockBalanceRecord {
  id: string;
  tenantId: string;
  variantId: string;
  locationId: string;
  bucket: StockBucket;
  quantity: number;
  updatedAt: Date;
}

export interface CreateMovementRequest {
  variantId: string;
  locationId: string;
  bucket: StockBucket;
  /** Non-zero; positive adds to the bucket, negative removes from it. */
  delta: number;
  reason: string;
  reference?: string | null;
}

export interface MovementActor {
  type: "user" | "api_key";
  id: string;
}

export interface StockTransferRequest {
  variantId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  reason: string;
}

export interface StockTransferInput extends StockTransferRequest {
  tenantId: string;
  transferId: string;
  actor: MovementActor | null;
  createdAt: Date;
  allowNegative: boolean;
}

export interface MovementWithBalance {
  movement: StockMovementRecord;
  balance: StockBalanceRecord;
}

export interface StockTransferResult {
  transferId: string;
  outbound: MovementWithBalance;
  inbound: MovementWithBalance;
}

export interface StockStore {
  /**
   * Appends the movement and upserts the derived balance in one
   * transaction. Throws on an FK violation when the variant or location
   * does not exist in this tenant.
   */
  recordMovement(record: StockMovementRecord): Promise<MovementWithBalance>;
  /**
   * Moves `quantity` on-hand from one location to another in a single
   * transaction. Locks the source balance and refuses the move when
   * available-to-promise would go negative (unless `allowNegative`).
   */
  transfer(input: StockTransferInput): Promise<StockTransferResult>;
  listMovements(
    tenantId: string,
    filter: {
      variantId?: string;
      locationId?: string;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<StockMovementRecord[]>;
  listBalances(
    tenantId: string,
    filter: {
      variantId?: string;
      locationId?: string;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<StockBalanceRecord[]>;
}

export interface StockServiceDeps {
  store: StockStore;
  clock: { now(): Date };
  /** Absent means strict: stock never goes negative. */
  policy?: TenantStockPolicyReader;
}
