/**
 * Base class for failures that callers are expected to handle by `code`
 * rather than by parsing messages.
 */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class InvalidPhoneError extends DomainError {
  constructor(raw: string) {
    super("INVALID_PHONE", `Invalid Egyptian mobile number: ${raw}`);
  }
}

export class InvalidMoneyError extends DomainError {
  constructor(amount: unknown) {
    super(
      "INVALID_MONEY",
      `Money must be an integer count of minor units, received ${String(amount)}`,
    );
  }
}

export class CurrencyMismatchError extends DomainError {
  constructor(left: string, right: string) {
    super("CURRENCY_MISMATCH", `Cannot combine ${left} with ${right}`);
  }
}
