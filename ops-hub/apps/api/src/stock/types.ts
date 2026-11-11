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

export interface StockStore {
  /**
   * Appends the movement and upserts the derived balance in one
   * transaction. Throws on an FK violation when the variant or location
   * does not exist in this tenant.
   */
  recordMovement(
    record: StockMovementRecord,
  ): Promise<{ movement: StockMovementRecord; balance: StockBalanceRecord }>;
  listMovements(
    tenantId: string,
    filter: { variantId?: string; locationId?: string },
  ): Promise<StockMovementRecord[]>;
  listBalances(
    tenantId: string,
    filter: { variantId?: string; locationId?: string },
  ): Promise<StockBalanceRecord[]>;
}

export interface StockServiceDeps {
  store: StockStore;
  clock: { now(): Date };
}
