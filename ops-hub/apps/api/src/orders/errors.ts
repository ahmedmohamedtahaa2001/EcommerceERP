import { DomainError } from "@ops-hub/shared";

export class OrderError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class OrderValidationError extends OrderError {
  constructor(message: string) {
    super("invalid-request", message, 422);
  }
}

export class IdempotencyKeyRequiredError extends OrderValidationError {
  constructor() {
    super("Idempotency-Key header is required.");
  }
}

export class IdempotencyConflictError extends OrderError {
  constructor() {
    super(
      "idempotency-conflict",
      "This Idempotency-Key was already used with a different request body.",
      422,
    );
  }
}

export class UnknownSkuError extends OrderError {
  constructor(sku: string) {
    super("unknown-sku", `No variant found for sku: ${sku}`, 422);
  }
}

export class OrderNotFoundError extends OrderError {
  constructor() {
    super("order-not-found", "Order not found.", 404);
  }
}
