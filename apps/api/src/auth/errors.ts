import { DomainError } from "@ops-hub/shared";

export class AuthError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super("invalid-credentials", "Invalid email or password.", 401);
  }
}

export class UnauthorizedError extends AuthError {
  constructor() {
    super("unauthenticated", "Authentication required.", 401);
  }
}

export class ForbiddenError extends AuthError {
  constructor(permission: string) {
    super("forbidden", `Missing permission: ${permission}`, 403);
  }
}

export class ValidationError extends AuthError {
  constructor(message: string) {
    super("invalid-request", message, 422);
  }
}

export class RateLimitedError extends AuthError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      "rate-limited",
      "Too many login attempts. Try again later.",
      429,
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
