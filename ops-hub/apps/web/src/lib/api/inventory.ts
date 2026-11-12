import { apiFetch } from "./client";

/**
 * Wire shapes for `/v1/inventory/*` and `/v1/locations*`, matching
 * `apps/api/src/{inventory,stock,availability}/types.ts`. Dates arrive as
 * ISO strings.
 *
 * Deviations from UI_PLAN §8, taken from the real API source:
 * - Movements/adjustments/reservations live under `/v1/inventory/*`
 *   (`/v1/inventory/movements`, `/v1/inventory/adjustments`,
 *   `/v1/inventory/reservations`), not `/stock/*`.
 * - Bins are created via `POST /v1/bins` (location passed in the body).
 */

export const STOCK_BUCKETS = [
  "on_hand",
  "reserved",
  "quarantined",
  "damaged",
  "in_transit",
] as const;
export type StockBucket = (typeof STOCK_BUCKETS)[number];

export const LOCATION_TYPES = ["warehouse", "3pl", "shop", "transit"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const RESERVATION_STATUSES = ["active", "released", "expired"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Matches `LocationRecord` in apps/api/src/inventory/types.ts. */
export interface Location {
  id: string;
  tenantId: string;
  type: LocationType;
  name: string;
  code: string | null;
  governorateCode: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Matches `BinRecord` in apps/api/src/inventory/types.ts. */
export interface Bin {
  id: string;
  tenantId: string;
  locationId: string;
  zone: string | null;
  code: string;
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Matches `StockMovementRecord` in apps/api/src/stock/types.ts. */
export interface StockMovement {
  id: string;
  tenantId: string;
  variantId: string;
  locationId: string | null;
  bucket: StockBucket;
  /** Positive adds to the bucket, negative removes. */
  delta: number;
  reason: string;
  reference: string | null;
  actorType: string | null;
  actorId: string | null;
  createdAt: string;
}

/** Matches `StockBalanceRecord` in apps/api/src/stock/types.ts. */
export interface StockBalance {
  id: string;
  tenantId: string;
  variantId: string;
  locationId: string;
  bucket: StockBucket;
  quantity: number;
  updatedAt: string;
}

/** Matches `LocationAvailability` in apps/api/src/availability/types.ts. */
export interface LocationAvailability {
  locationId: string;
  onHand: number;
  reserved: number;
  quarantined: number;
  damaged: number;
  availableToPromise: number;
}

/** Matches `Availability` in apps/api/src/availability/types.ts. */
export interface Availability {
  sku: string;
  variantId: string;
  locations: LocationAvailability[];
  total: {
    onHand: number;
    reserved: number;
    quarantined: number;
    damaged: number;
    availableToPromise: number;
  };
}

/** Matches `StockReservationRecord` in apps/api/src/stock/reservation-types.ts. */
export interface StockReservation {
  id: string;
  tenantId: string;
  variantId: string;
  locationId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  releasedAt: string | null;
}

export interface RecordMovementRequest {
  variantId: string;
  locationId: string;
  bucket: StockBucket;
  delta: number;
  reason: string;
  reference?: string | null;
}

export interface CreateLocationRequest {
  type: LocationType;
  name: string;
  code?: string | null;
  governorateCode?: string | null;
  address?: string | null;
}

export interface CreateBinRequest {
  locationId: string;
  code: string;
  zone?: string | null;
  capacity?: number | null;
}

export interface CreateReservationRequest {
  variantId: string;
  locationId: string;
  quantity: number;
  ttlSeconds: number;
}

/** `POST /v1/inventory/movements` → 201. */
export function recordMovement(
  body: RecordMovementRequest,
): Promise<{ movement: StockMovement; balance: StockBalance }> {
  return apiFetch<{ movement: StockMovement; balance: StockBalance }>(
    "/v1/inventory/movements",
    { method: "POST", body },
  );
}

/** `GET /v1/inventory/movements?variantId&locationId` → 200. */
export function listMovements(params: {
  variantId?: string;
  locationId?: string;
}): Promise<{ movements: StockMovement[] }> {
  return apiFetch<{ movements: StockMovement[] }>("/v1/inventory/movements", {
    searchParams: params,
  });
}

/** `GET /v1/inventory/balances?variantId&locationId` → 200. */
export function listBalances(params: {
  variantId?: string;
  locationId?: string;
}): Promise<{ balances: StockBalance[] }> {
  return apiFetch<{ balances: StockBalance[] }>("/v1/inventory/balances", {
    searchParams: params,
  });
}

/**
 * `POST /v1/inventory/adjustments {variantId, locationId, bucket, delta,
 * reason}` → 201. Validation requires a reason from
 * `ADJUSTMENT_REASONS` (COUNT_VARIANCE, DAMAGE, LOSS, FOUND, CORRECTION).
 */
export function createAdjustment(
  body: RecordMovementRequest,
): Promise<StockMovement> {
  return apiFetch<StockMovement>("/v1/inventory/adjustments", {
    method: "POST",
    body,
  });
}

/**
 * `GET /v1/inventory/availability?sku&location` → 200. `sku` is required
 * server-side; `location` is an optional location id.
 */
export function getAvailability(params: {
  sku: string;
  location?: string;
}): Promise<Availability> {
  return apiFetch<Availability>("/v1/inventory/availability", {
    searchParams: params,
  });
}

/** `POST /v1/inventory/reservations` → 201. */
export function createReservation(
  body: CreateReservationRequest,
): Promise<StockReservation> {
  return apiFetch<StockReservation>("/v1/inventory/reservations", {
    method: "POST",
    body,
  });
}

/** `POST /v1/inventory/reservations/:id/release` → 200. */
export function releaseReservation(id: string): Promise<StockReservation> {
  return apiFetch<StockReservation>(
    `/v1/inventory/reservations/${encodeURIComponent(id)}/release`,
    { method: "POST" },
  );
}

/** `GET /v1/locations` → 200. */
export function listLocations(): Promise<{ locations: Location[] }> {
  return apiFetch<{ locations: Location[] }>("/v1/locations");
}

/** `GET /v1/locations/:id` → 200. */
export function getLocation(id: string): Promise<Location> {
  return apiFetch<Location>(`/v1/locations/${encodeURIComponent(id)}`);
}

/** `POST /v1/locations` → 201. */
export function createLocation(body: CreateLocationRequest): Promise<Location> {
  return apiFetch<Location>("/v1/locations", { method: "POST", body });
}

/** `DELETE /v1/locations/:id` → 204 (fails on FK restrict while stock exists). */
export function deleteLocation(id: string): Promise<void> {
  return apiFetch<void>(`/v1/locations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** `GET /v1/locations/:locationId/bins` → 200. */
export function listBins(locationId: string): Promise<{ bins: Bin[] }> {
  return apiFetch<{ bins: Bin[] }>(
    `/v1/locations/${encodeURIComponent(locationId)}/bins`,
  );
}

/** `POST /v1/bins` → 201. */
export function createBin(body: CreateBinRequest): Promise<Bin> {
  return apiFetch<Bin>("/v1/bins", { method: "POST", body });
}
