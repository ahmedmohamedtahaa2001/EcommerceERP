import { DomainError } from "@ops-hub/shared";

export class StockError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class StockValidationError extends StockError {
  constructor(message: string) {
    super("invalid-request", message, 422);
  }
}

/** The variant or location referenced by a movement doesn't exist in this tenant. */
export class StockReferenceNotFoundError extends StockError {
  constructor() {
    super(
      "stock-reference-not-found",
      "The variant or location for this movement was not found.",
      404,
    );
  }
}
