import type { Clock } from "@ops-hub/shared";

export type LocationType = "warehouse" | "3pl" | "shop" | "transit";

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

export interface CreateLocationInput {
  type: LocationType;
  name: string;
  code?: string | null;
  governorateCode?: string | null;
  address?: string | null;
}

export interface UpdateLocationInput {
  type?: LocationType;
  name?: string;
  code?: string | null;
  governorateCode?: string | null;
  address?: string | null;
}

export interface CreateBinInput {
  zone?: string | null;
  code: string;
  capacity?: number | null;
}

export interface UpdateBinInput {
  zone?: string | null;
  code?: string;
  capacity?: number | null;
}

export interface LocationStore {
  createLocation(location: LocationRecord): Promise<void>;
  getLocation(tenantId: string, id: string): Promise<LocationRecord | null>;
  listLocations(tenantId: string): Promise<LocationRecord[]>;
  updateLocation(location: LocationRecord): Promise<boolean>;
  deleteLocation(
    tenantId: string,
    id: string,
  ): Promise<"deleted" | "has_stock" | null>;

  createBin(bin: BinRecord): Promise<void>;
  getBin(tenantId: string, id: string): Promise<BinRecord | null>;
  listBinsByLocation(tenantId: string, locationId: string): Promise<BinRecord[]>;
  updateBin(bin: BinRecord): Promise<boolean>;
  deleteBin(tenantId: string, id: string): Promise<"deleted" | "has_stock" | null>;
}

export interface LocationServiceDeps {
  store: LocationStore;
  clock: Clock;
}
