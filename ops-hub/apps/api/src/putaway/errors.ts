import { DomainError } from "@ops-hub/shared";

export class PutawayError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class PutawayValidationError extends PutawayError {
  constructor(message: string) {
    super("invalid-request", message, 422);
  }
}

export class BinNotFoundError extends PutawayError {
  constructor() {
    super("bin-not-found", "Bin not found.", 404);
  }
}

/** Only stock on hand at the location and not yet placed in a bin can be put away. */
export class UnassignedStockError extends PutawayError {
  constructor(available: number, requested: number) {
    super(
      "insufficient-unassigned-stock",
      `Only ${available} unit(s) of this SKU are on hand at this location without a bin; ${requested} requested.`,
      409,
    );
  }
}

export class BinCapacityError extends PutawayError {
  constructor(free: number, requested: number) {
    super(
      "bin-capacity-exceeded",
      `This bin has room for ${free} more unit(s); ${requested} requested.`,
      409,
    );
  }
}
