import { AuthError } from "../auth/errors";

export class InvalidStockInputError extends AuthError {
  constructor(message: string) {
    super("invalid-stock-input", message, 422);
  }
}

export class VariantNotFoundError extends AuthError {
  constructor() {
    super("variant-not-found", "Variant not found.", 404);
  }
}

export class LocationNotFoundError extends AuthError {
  constructor() {
    super("location-not-found", "Location not found.", 404);
  }
}
