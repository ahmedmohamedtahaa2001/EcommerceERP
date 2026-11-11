import { DomainError } from "@ops-hub/shared";

export class AvailabilityError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class AvailabilityValidationError extends AvailabilityError {
  constructor(message: string) {
    super("invalid-request", message, 422);
  }
}

export class SkuNotFoundError extends AvailabilityError {
  constructor(sku: string) {
    super("sku-not-found", `No variant found for sku: ${sku}`, 404);
  }
}
