import { DomainError } from "@ops-hub/shared";

export class ReservationError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class ReservationValidationError extends ReservationError {
  constructor(message: string) {
    super("invalid-request", message, 422);
  }
}

export class ReservationNotFoundError extends ReservationError {
  constructor() {
    super("reservation-not-found", "Reservation not found.", 404);
  }
}

export class ReservationAlreadyClosedError extends ReservationError {
  constructor() {
    super(
      "reservation-already-closed",
      "Reservation is already released or expired.",
      409,
    );
  }
}

export class InsufficientStockError extends ReservationError {
  constructor(available: number, requested: number) {
    super(
      "insufficient-stock",
      `Only ${available} available but ${requested} requested.`,
      409,
    );
  }
}
