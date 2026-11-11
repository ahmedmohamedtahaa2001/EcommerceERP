import { AuthError } from "../auth/errors";

export class LocationNotFoundError extends AuthError {
  constructor() {
    super("location-not-found", "Location not found.", 404);
  }
}

export class BinNotFoundError extends AuthError {
  constructor() {
    super("bin-not-found", "Bin not found.", 404);
  }
}

export class DuplicateLocationCodeError extends AuthError {
  constructor() {
    super("duplicate-location-code", "Location code already exists.", 409);
  }
}

export class DuplicateBinCodeError extends AuthError {
  constructor() {
    super("duplicate-bin-code", "Bin code already exists for this location.", 409);
  }
}

export class LocationHasStockError extends AuthError {
  constructor() {
    super("location-has-stock", "Location cannot be deleted while stock movements exist.", 409);
  }
}

export class InvalidLocationInputError extends AuthError {
  constructor(message: string) {
    super("invalid-location-input", message, 422);
  }
}
