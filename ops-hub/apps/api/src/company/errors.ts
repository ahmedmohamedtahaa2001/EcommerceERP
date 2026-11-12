import { DomainError } from "@ops-hub/shared";

export class CompanyValidationError extends DomainError {
  readonly statusCode = 422;

  constructor(message: string) {
    super("invalid-request", message);
  }
}
