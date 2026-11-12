import { randomUUID } from "node:crypto";

import {
  BinNotFoundError,
  DuplicateBinCodeError,
  DuplicateLocationCodeError,
  InventoryValidationError,
  LocationHasStockError,
  LocationNotFoundError,
} from "./errors";
import {
  LOCATION_TYPES,
  type BinRecord,
  type CreateBinRequest,
  type CreateLocationRequest,
  type InventoryServiceDeps,
  type LocationRecord,
} from "./types";

const MAX_NAME_LENGTH = 300;
const MAX_CODE_LENGTH = 100;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function requireName(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InventoryValidationError(`${field} is required.`);
  }
  if (value.length > MAX_NAME_LENGTH) {
    throw new InventoryValidationError(
      `${field} must be at most ${MAX_NAME_LENGTH} characters.`,
    );
  }
  return value;
}

function validateCode(value: string, field: string): string {
  if (
    value === "" ||
    value.length > MAX_CODE_LENGTH ||
    !CODE_PATTERN.test(value)
  ) {
    throw new InventoryValidationError(
      `${field} must be 1-100 characters, starting alphanumeric, using only letters, digits, '.', '_' and '-'.`,
    );
  }
  return value;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function isForeignKeyRestrictViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23503"
  );
}

export class InventoryService {
  constructor(private readonly deps: InventoryServiceDeps) {}

  async createLocation(
    request: CreateLocationRequest,
    tenantId: string,
  ): Promise<LocationRecord> {
    if (!(LOCATION_TYPES as readonly string[]).includes(request.type)) {
      throw new InventoryValidationError(
        `type must be one of: ${LOCATION_TYPES.join(", ")}.`,
      );
    }
    const name = requireName(request.name, "name");
    const code =
      request.code !== undefined && request.code !== null
        ? validateCode(request.code, "code")
        : null;

    const now = this.deps.clock.now();
    const record: LocationRecord = {
      id: randomUUID(),
      tenantId,
      type: request.type,
      name,
      code,
      governorateCode: request.governorateCode ?? null,
      address: request.address ?? null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.deps.locations.create(record);
    } catch (error) {
      if (isUniqueViolation(error) && code !== null) {
        throw new DuplicateLocationCodeError(code);
      }
      throw error;
    }
    return record;
  }

  async getLocation(tenantId: string, id: string): Promise<LocationRecord> {
    const location = await this.deps.locations.getById(tenantId, id);
    if (!location) {
      throw new LocationNotFoundError();
    }
    return location;
  }

  async listLocations(
    tenantId: string,
    filter: {
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    } = {},
  ): Promise<LocationRecord[]> {
    return this.deps.locations.list(tenantId, filter);
  }

  /**
   * `stock_balances`, `stock_movements`, and `stock_reservations` all
   * reference `location_id` with `ON DELETE RESTRICT`; Postgres itself
   * rejects the delete when any of them still point at this location, so
   * there is nothing to pre-check here.
   */
  async deleteLocation(tenantId: string, id: string): Promise<void> {
    const existing = await this.deps.locations.getById(tenantId, id);
    if (!existing) {
      throw new LocationNotFoundError();
    }

    try {
      const deleted = await this.deps.locations.delete(tenantId, id);
      if (!deleted) {
        throw new LocationNotFoundError();
      }
    } catch (error) {
      if (isForeignKeyRestrictViolation(error)) {
        throw new LocationHasStockError();
      }
      throw error;
    }
  }

  async createBin(
    request: CreateBinRequest,
    tenantId: string,
  ): Promise<BinRecord> {
    const location = await this.deps.locations.getById(
      tenantId,
      request.locationId,
    );
    if (!location) {
      throw new LocationNotFoundError();
    }

    const code = validateCode(request.code, "code");
    if (
      request.capacity !== undefined &&
      request.capacity !== null &&
      (!Number.isInteger(request.capacity) || request.capacity < 0)
    ) {
      throw new InventoryValidationError(
        "capacity must be a non-negative integer.",
      );
    }

    const now = this.deps.clock.now();
    const record: BinRecord = {
      id: randomUUID(),
      tenantId,
      locationId: request.locationId,
      zone: request.zone ?? null,
      code,
      capacity: request.capacity ?? null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.deps.bins.create(record);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateBinCodeError(code);
      }
      throw error;
    }
    return record;
  }

  async getBin(tenantId: string, id: string): Promise<BinRecord> {
    const bin = await this.deps.bins.getById(tenantId, id);
    if (!bin) {
      throw new BinNotFoundError();
    }
    return bin;
  }

  async listBins(tenantId: string, locationId: string): Promise<BinRecord[]> {
    const location = await this.deps.locations.getById(tenantId, locationId);
    if (!location) {
      throw new LocationNotFoundError();
    }
    return this.deps.bins.listByLocation(tenantId, locationId);
  }
}
