export const RESERVATION_STATUSES = ["active", "released", "expired"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface StockReservationRecord {
  id: string;
  tenantId: string;
  variantId: string;
  locationId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  releasedAt: Date | null;
}

export interface CreateReservationRequest {
  variantId: string;
  locationId: string;
  quantity: number;
  ttlSeconds: number;
}

export interface ReservationStore {
  create(record: StockReservationRecord): Promise<void>;
  getById(tenantId: string, id: string): Promise<StockReservationRecord | null>;
  /** Marks an active reservation released/expired; no-op (returns false) if it
   * isn't active (already released/expired, or a concurrent call won the race). */
  closeActive(
    tenantId: string,
    id: string,
    status: "released" | "expired",
    releasedAt: Date,
  ): Promise<boolean>;
  /** All active reservations whose `expiresAt` is at or before `asOf`. */
  listExpiredActive(
    tenantId: string,
    asOf: Date,
  ): Promise<StockReservationRecord[]>;
}

export interface ReservationBalanceReader {
  getBucketQuantities(
    tenantId: string,
    variantId: string,
    locationId: string,
  ): Promise<{
    onHand: number;
    reserved: number;
    quarantined: number;
    damaged: number;
  }>;
}

export interface MovementRecorder {
  recordMovement(
    request: {
      variantId: string;
      locationId: string;
      bucket: "reserved";
      delta: number;
      reason: string;
      reference?: string;
    },
    tenantId: string,
    actor: { type: "user" | "api_key"; id: string } | null,
  ): Promise<unknown>;
}

export interface ReservationLock {
  withLock<T>(key: string, work: () => Promise<T>): Promise<T>;
}

export interface ReservationServiceDeps {
  store: ReservationStore;
  balances: ReservationBalanceReader;
  movements: MovementRecorder;
  lock: ReservationLock;
  clock: { now(): Date };
}
