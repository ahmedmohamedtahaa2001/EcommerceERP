import { randomUUID } from "node:crypto";

import {
  DuplicateBinCodeError,
  DuplicateLocationCodeError,
  InvalidLocationInputError,
  LocationHasStockError,
  LocationNotFoundError,
  BinNotFoundError,
} from "./errors";
import type {
  BinRecord,
  CreateBinInput,
  CreateLocationInput,
  LocationRecord,
  LocationServiceDeps,
  LocationType,
  UpdateBinInput,
  UpdateLocationInput,
} from "./types";

const MAX_NAME_LENGTH = 200;
const MAX_CODE_LENGTH = 64;
const LOCATION_TYPES = ["warehouse", "3pl", "shop", "transit"] as const;

function validateName(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new InvalidLocationInputError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_NAME_LENGTH) {
    throw new InvalidLocationInputError(
      `${field} must be 1-${MAX_NAME_LENGTH} characters.`,
    );
  }
  return trimmed;
}

function validateType(value: unknown): LocationType {
  if (typeof value !== "string" || !(LOCATION_TYPES as readonly string[]).includes(value)) {
    throw new InvalidLocationInputError(
      `type must be one of: ${LOCATION_TYPES.join(", ")}.`,
    );
  }
  return value as LocationType;
}

function validateCode(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new InvalidLocationInputError(`${field} must be a string or null.`);
  }
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > MAX_CODE_LENGTH) {
    throw new InvalidLocationInputError(
      `${field} must be at most ${MAX_CODE_LENGTH} characters.`,
    );
  }
  return trimmed;
}

function validateGovernorate(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new InvalidLocationInputError("governorateCode must be a string or null.");
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function validateAddress(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new InvalidLocationInputError("address must be a string or null.");
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function validateZone(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new InvalidLocationInputError("zone must be a string or null.");
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function validateBinCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new InvalidLocationInputError("code must be a string.");
  }
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_CODE_LENGTH) {
    throw new InvalidLocationInputError(
      `code must be 1-${MAX_CODE_LENGTH} characters.`,
    );
  }
  return trimmed;
}

function validateCapacity(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new InvalidLocationInputError("capacity must be a non-negative integer or null.");
  }
  return value;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

export class LocationService {
  constructor(private readonly deps: LocationServiceDeps) {}

  async createLocation(
    input: CreateLocationInput,
    tenantId: string,
  ): Promise<LocationRecord> {
    const now = this.deps.clock.now();
    const location: LocationRecord = {
      id: randomUUID(),
      tenantId,
      type: validateType(input.type),
      name: validateName(input.name, "name"),
      code: validateCode(input.code, "code"),
      governorateCode: validateGovernorate(input.governorateCode),
      address: validateAddress(input.address),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.deps.store.createLocation(location);
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateLocationCodeError();
      throw error;
    }
    return location;
  }

  async getLocation(tenantId: string, id: string): Promise<LocationRecord | null> {
    return this.deps.store.getLocation(tenantId, id);
  }

  async listLocations(tenantId: string): Promise<LocationRecord[]> {
    return this.deps.store.listLocations(tenantId);
  }

  async updateLocation(
    tenantId: string,
    id: string,
    input: UpdateLocationInput,
  ): Promise<LocationRecord> {
    const existing = await this.deps.store.getLocation(tenantId, id);
    if (!existing) throw new LocationNotFoundError();

    const updated: LocationRecord = {
      ...existing,
      type: input.type !== undefined ? validateType(input.type) : existing.type,
      name: input.name !== undefined ? validateName(input.name, "name") : existing.name,
      code: input.code !== undefined ? validateCode(input.code, "code") : existing.code,
      governorateCode:
        input.governorateCode !== undefined
          ? validateGovernorate(input.governorateCode)
          : existing.governorateCode,
      address:
        input.address !== undefined ? validateAddress(input.address) : existing.address,
      updatedAt: this.deps.clock.now(),
    };
    try {
      const ok = await this.deps.store.updateLocation(updated);
      if (!ok) throw new LocationNotFoundError();
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateLocationCodeError();
      throw error;
    }
    return updated;
  }

  async deleteLocation(tenantId: string, id: string): Promise<void> {
    const existing = await this.deps.store.getLocation(tenantId, id);
    if (!existing) throw new LocationNotFoundError();
    const result = await this.deps.store.deleteLocation(tenantId, id);
    if (result === null) throw new LocationNotFoundError();
    if (result === "has_stock") throw new LocationHasStockError();
  }

  async createBin(
    tenantId: string,
    locationId: string,
    input: CreateBinInput,
  ): Promise<BinRecord> {
    const location = await this.deps.store.getLocation(tenantId, locationId);
    if (!location) throw new LocationNotFoundError();

    const now = this.deps.clock.now();
    const bin: BinRecord = {
      id: randomUUID(),
      tenantId,
      locationId,
      zone: validateZone(input.zone),
      code: validateBinCode(input.code),
      capacity: validateCapacity(input.capacity),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.deps.store.createBin(bin);
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateBinCodeError();
      throw error;
    }
    return bin;
  }

  async getBin(tenantId: string, id: string): Promise<BinRecord | null> {
    return this.deps.store.getBin(tenantId, id);
  }

  async listBinsByLocation(tenantId: string, locationId: string): Promise<BinRecord[]> {
    const location = await this.deps.store.getLocation(tenantId, locationId);
    if (!location) throw new LocationNotFoundError();
    return this.deps.store.listBinsByLocation(tenantId, locationId);
  }

  async updateBin(
    tenantId: string,
    id: string,
    input: UpdateBinInput,
  ): Promise<BinRecord> {
    const existing = await this.deps.store.getBin(tenantId, id);
    if (!existing) throw new BinNotFoundError();

    const updated: BinRecord = {
      ...existing,
      zone: input.zone !== undefined ? validateZone(input.zone) : existing.zone,
      code: input.code !== undefined ? validateBinCode(input.code) : existing.code,
      capacity:
        input.capacity !== undefined ? validateCapacity(input.capacity) : existing.capacity,
      updatedAt: this.deps.clock.now(),
    };
    try {
      const ok = await this.deps.store.updateBin(updated);
      if (!ok) throw new BinNotFoundError();
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateBinCodeError();
      throw error;
    }
    return updated;
  }

  async deleteBin(tenantId: string, id: string): Promise<void> {
    const existing = await this.deps.store.getBin(tenantId, id);
    if (!existing) throw new BinNotFoundError();
    const result = await this.deps.store.deleteBin(tenantId, id);
    if (result === null) throw new BinNotFoundError();
    if (result === "has_stock") throw new LocationHasStockError();
  }
}
