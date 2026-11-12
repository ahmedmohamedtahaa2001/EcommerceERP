import { DomainError } from "@ops-hub/shared";

export class CustomerError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class CustomerValidationError extends CustomerError {
  constructor(message: string) {
    super("invalid-request", message, 422);
  }
}

export class CustomerNotFoundError extends CustomerError {
  constructor() {
    super("customer-not-found", "Customer not found.", 404);
  }
}

export class DuplicateCustomerPhoneError extends CustomerError {
  constructor(phone: string) {
    super(
      "duplicate-phone",
      `A customer with this phone already exists: ${phone}`,
      409,
    );
  }
}

export class DuplicateCustomerEmailError extends CustomerError {
  constructor(email: string) {
    super(
      "duplicate-email",
      `A customer with this email already exists: ${email}`,
      409,
    );
  }
}
