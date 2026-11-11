import { DomainError } from "@ops-hub/shared";

export class InventoryError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class InventoryValidationError extends InventoryError {
  constructor(message: string) {
    super("invalid-request", message, 422);
  }
}

export class LocationNotFoundError extends InventoryError {
  constructor() {
    super("location-not-found", "Location not found.", 404);
  }
}

export class BinNotFoundError extends InventoryError {
  constructor() {
    super("bin-not-found", "Bin not found.", 404);
  }
}

export class DuplicateLocationCodeError extends InventoryError {
  constructor(code: string) {
    super(
      "duplicate-location-code",
      `Location code already exists: ${code}`,
      409,
    );
  }
}

export class DuplicateBinCodeError extends InventoryError {
  constructor(code: string) {
    super(
      "duplicate-bin-code",
      `Bin code already exists in this location: ${code}`,
      409,
    );
  }
}

export class LocationHasStockError extends InventoryError {
  constructor() {
    super(
      "location-has-stock",
      "Location cannot be deleted while it still has stock balances, movements, or reservations.",
      409,
    );
  }
}
