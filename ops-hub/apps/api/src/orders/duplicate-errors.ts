import { DomainError } from "@ops-hub/shared";

export class DuplicateReviewError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class ExceptionNotFoundError extends DuplicateReviewError {
  constructor() {
    super("exception-not-found", "Exception not found.", 404);
  }
}

export class NotADuplicateExceptionError extends DuplicateReviewError {
  constructor() {
    super(
      "not-a-duplicate-exception",
      "This exception isn't a DUPLICATE_SUSPECTED exception.",
      422,
    );
  }
}

export class ExceptionAlreadyResolvedError extends DuplicateReviewError {
  constructor() {
    super(
      "exception-already-resolved",
      "This exception was already resolved.",
      409,
    );
  }
}
