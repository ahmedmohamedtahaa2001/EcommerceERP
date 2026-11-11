import type { Clock } from "@ops-hub/shared";

export const BUCKETS = ["on_hand", "reserved", "quarantined", "damaged", "in_transit"] as const;
export type Bucket = (typeof BUCKETS)[number];

export interface StockMovementRecord {
  id: string;
  tenantId: string;
  variantId: string;
  locationId: string | null;
  bucket: Bucket;
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
  bucket: Bucket;
  quantity: number;
  updatedAt: Date;
}

export interface RecordMovementInput {
  variantId: string;
  locationId: string;
  bucket: Bucket;
  delta: number;
  reason: string;
  reference?: string | null;
}

export interface StockStore {
  applyMovement(movement: StockMovementRecord): Promise<void>;
  getBalance(
    tenantId: string,
    variantId: string,
    locationId: string,
    bucket: Bucket,
  ): Promise<number>;
  getBalances(
    tenantId: string,
    variantId: string,
    locationId: string,
  ): Promise<Record<Bucket, number>>;
  listMovements(
    tenantId: string,
    filters: { variantId?: string; locationId?: string },
  ): Promise<StockMovementRecord[]>;
}

export interface StockServiceDeps {
  store: StockStore;
  clock: Clock;
}
