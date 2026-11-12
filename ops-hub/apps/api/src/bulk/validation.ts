import { BulkValidationError } from "./errors";

export const MAX_BULK_ITEMS = 500;
export const MIN_PERCENT_CHANGE = -90;
export const MAX_PERCENT_CHANGE = 1000;
export const MAX_PRICE_MINOR = 100_000_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dedupes and checks a list of ids. Order is kept; a bulk call is capped so one request stays bounded. */
export function requireIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new BulkValidationError("ids must be an array of ids.");
  }
  const ids = [...new Set(value)];
  if (ids.length === 0) {
    throw new BulkValidationError("Select at least one item.");
  }
  if (ids.length > MAX_BULK_ITEMS) {
    throw new BulkValidationError(
      `A bulk change is limited to ${MAX_BULK_ITEMS} items per request.`,
    );
  }
  for (const id of ids) {
    if (typeof id !== "string" || !UUID.test(id)) {
      throw new BulkValidationError("Every id must be a valid identifier.");
    }
  }
  return ids as string[];
}

export type PriceMode = "percent" | "set";

export function requirePriceChange(input: { mode: unknown; value: unknown }): {
  mode: PriceMode;
  value: number;
} {
  if (input.mode !== "percent" && input.mode !== "set") {
    throw new BulkValidationError("mode must be 'percent' or 'set'.");
  }
  const value = input.value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BulkValidationError("value must be a number.");
  }
  if (input.mode === "percent") {
    if (value < MIN_PERCENT_CHANGE || value > MAX_PERCENT_CHANGE) {
      throw new BulkValidationError(
        `A percentage change must be between ${MIN_PERCENT_CHANGE} and ${MAX_PERCENT_CHANGE}.`,
      );
    }
    return { mode: "percent", value };
  }
  if (!Number.isInteger(value) || value < 0 || value > MAX_PRICE_MINOR) {
    throw new BulkValidationError(
      "A fixed price must be a whole number of minor units, zero or more.",
    );
  }
  return { mode: "set", value };
}
