import { CompanyValidationError } from "./errors";

export const SUPPORTED_CURRENCIES = [
  "EGP",
  "USD",
  "EUR",
  "SAR",
  "AED",
] as const;
export const SUPPORTED_COUNTRIES = [
  "EG",
  "SA",
  "AE",
  "KW",
  "QA",
  "JO",
  "US",
  "GB",
] as const;
const MAX_NAME_LENGTH = 120;

export interface CompanyPatch {
  name?: string;
  timezone?: string;
  defaultCurrency?: string;
  countryCode?: string;
  allowNegativeStock?: boolean;
}

const OWNED_FIELDS = [
  "name",
  "timezone",
  "defaultCurrency",
  "countryCode",
  "allowNegativeStock",
] as const;

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Accepts only the fields this screen owns, each checked against its own rule. */
export function requireCompanyPatch(
  input: Record<string, unknown>,
): CompanyPatch {
  const unknown = Object.keys(input).filter(
    (key) => !(OWNED_FIELDS as readonly string[]).includes(key),
  );
  if (unknown.length > 0) {
    throw new CompanyValidationError(`Cannot change: ${unknown.join(", ")}.`);
  }
  const patch: CompanyPatch = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string")
      throw new CompanyValidationError("name must be text.");
    const name = input.name.trim();
    if (name === "" || name.length > MAX_NAME_LENGTH) {
      throw new CompanyValidationError(
        `name must be 1-${MAX_NAME_LENGTH} characters.`,
      );
    }
    patch.name = name;
  }
  if (input.timezone !== undefined) {
    if (
      typeof input.timezone !== "string" ||
      !isValidTimezone(input.timezone)
    ) {
      throw new CompanyValidationError(
        "timezone must be a valid IANA zone, such as Africa/Cairo.",
      );
    }
    patch.timezone = input.timezone;
  }
  if (input.defaultCurrency !== undefined) {
    if (
      typeof input.defaultCurrency !== "string" ||
      !(SUPPORTED_CURRENCIES as readonly string[]).includes(
        input.defaultCurrency,
      )
    ) {
      throw new CompanyValidationError(
        `defaultCurrency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}.`,
      );
    }
    patch.defaultCurrency = input.defaultCurrency;
  }
  if (input.countryCode !== undefined) {
    if (
      typeof input.countryCode !== "string" ||
      !(SUPPORTED_COUNTRIES as readonly string[]).includes(input.countryCode)
    ) {
      throw new CompanyValidationError(
        `countryCode must be one of: ${SUPPORTED_COUNTRIES.join(", ")}.`,
      );
    }
    patch.countryCode = input.countryCode;
  }
  if (input.allowNegativeStock !== undefined) {
    if (typeof input.allowNegativeStock !== "boolean") {
      throw new CompanyValidationError(
        "allowNegativeStock must be true or false.",
      );
    }
    patch.allowNegativeStock = input.allowNegativeStock;
  }
  if (Object.keys(patch).length === 0) {
    throw new CompanyValidationError("Nothing to change.");
  }
  return patch;
}
