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
  createdAt: Date;
  updatedAt: Date;
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

export interface CreateLocationRequest {
  type: LocationType;
  name: string;
  code?: string | null;
  governorateCode?: string | null;
  address?: string | null;
}

export interface CreateBinRequest {
  locationId: string;
  zone?: string | null;
  code: string;
  capacity?: number | null;
}

export interface LocationStore {
  create(record: LocationRecord): Promise<void>;
  getById(tenantId: string, id: string): Promise<LocationRecord | null>;
  list(
    tenantId: string,
    filter?: {
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<LocationRecord[]>;
  /** Throws on an FK restrict violation when the location still has stock. */
  delete(tenantId: string, id: string): Promise<boolean>;
}

export interface BinStore {
  create(record: BinRecord): Promise<void>;
  getById(tenantId: string, id: string): Promise<BinRecord | null>;
  listByLocation(tenantId: string, locationId: string): Promise<BinRecord[]>;
}

export interface InventoryServiceDeps {
  locations: LocationStore;
  bins: BinStore;
  clock: { now(): Date };
}
