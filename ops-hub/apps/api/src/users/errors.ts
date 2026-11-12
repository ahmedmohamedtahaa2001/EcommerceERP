import { DomainError } from "@ops-hub/shared";

export class UserAdminError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class UserValidationError extends UserAdminError {
  constructor(message: string) {
    super("invalid-request", message, 422);
  }
}

export class MemberNotFoundError extends UserAdminError {
  constructor() {
    super("member-not-found", "Team member not found.", 404);
  }
}

export class EmailAlreadyRegisteredError extends UserAdminError {
  constructor() {
    super(
      "email-taken",
      "An account already exists for this email. Accounts cannot yet be shared between businesses.",
      409,
    );
  }
}

export class SelfChangeError extends UserAdminError {
  constructor() {
    super(
      "self-change-not-allowed",
      "You cannot change your own role or deactivate yourself.",
      422,
    );
  }
}

export class LastOwnerError extends UserAdminError {
  constructor() {
    super("last-owner", "A business must keep at least one active owner.", 422);
  }
}
