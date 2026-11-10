import { CurrencyMismatchError, InvalidMoneyError } from "./errors";

export type CurrencyCode = "EGP" | "USD" | "SAR" | "AED";

export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

/** Money is always an integer number of minor units (piastres for EGP). */
export function createMoney(
  amountMinor: number,
  currency: CurrencyCode,
): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new InvalidMoneyError(amountMinor);
  }
  return { amountMinor, currency };
}

export function addMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) {
    throw new CurrencyMismatchError(left.currency, right.currency);
  }
  return createMoney(left.amountMinor + right.amountMinor, left.currency);
}
