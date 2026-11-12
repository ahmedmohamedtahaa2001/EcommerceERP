export const LOCATION_TYPES = ["warehouse", "3pl", "shop", "transit"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export interface LocationRecord {
  id: string;
  tenantId: string;
  type: LocationType;
  name: string;
  code: string | null;
  governorateCode: string | null;
  address: string | null;
  /** Maximum units the location holds; null means not limited. */
  capacity: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A location as read back: adds how full it is right now. */
export interface LocationView extends LocationRecord {
  /** On-hand units across every variant at this location. */
  usedUnits: number;
  /** Null when the location has no capacity limit. */
  utilizationPercent: number | null;
}

export interface BinRecord {
  id: string;
  tenantId: string;
  locationId: string;
  zone: string | null;
  code: string;
  capacity: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A bin as listed for a location, with how many units are stored in it. */
export interface BinListItem extends BinRecord {
  used: number;
}

export interface CreateLocationRequest {
  type: LocationType;
  name: string;
  code?: string | null;
  governorateCode?: string | null;
  address?: string | null;
  capacity?: number | null;
}

export interface CreateBinRequest {
  locationId: string;
  zone?: string | null;
  code: string;
  capacity?: number | null;
}

export interface LocationStore {
  create(record: LocationRecord): Promise<void>;
  getById(tenantId: string, id: string): Promise<LocationView | null>;
  list(
    tenantId: string,
    filter?: {
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<LocationView[]>;
  updateCapacity(
    tenantId: string,
    id: string,
    capacity: number | null,
  ): Promise<LocationView | null>;
  /** Throws on an FK restrict violation when the location still has stock. */
  delete(tenantId: string, id: string): Promise<boolean>;
}

export interface BinStore {
  create(record: BinRecord): Promise<void>;
  getById(tenantId: string, id: string): Promise<BinRecord | null>;
  listByLocation(tenantId: string, locationId: string): Promise<BinListItem[]>;
}

export interface InventoryServiceDeps {
  locations: LocationStore;
  bins: BinStore;
  clock: { now(): Date };
}
