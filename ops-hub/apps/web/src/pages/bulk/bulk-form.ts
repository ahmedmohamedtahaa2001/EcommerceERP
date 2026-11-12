import { parseMajorToMinor } from "../../lib/money";

export type PriceMode = "percent" | "set";

export interface PriceChangeValues {
  mode: PriceMode;
  value: string;
}

export interface PriceChangeErrors {
  value?: "number" | "percentRange" | "price";
}

const PERCENT = /^-?\d+(\.\d+)?$/;

export function validatePriceChange(
  values: PriceChangeValues,
): PriceChangeErrors {
  const text = values.value.trim();
  if (values.mode === "percent") {
    if (!PERCENT.test(text)) return { value: "number" };
    const number = Number(text);
    return number < -90 || number > 1000 ? { value: "percentRange" } : {};
  }
  try {
    const minor = parseMajorToMinor(text);
    return minor === null ? { value: "price" } : {};
  } catch {
    return { value: "price" };
  }
}

/** Call only after `validatePriceChange` reports no errors. */
export function buildPriceChange(values: PriceChangeValues): {
  mode: PriceMode;
  value: number;
} {
  if (values.mode === "percent") {
    return { mode: "percent", value: Number(values.value.trim()) };
  }
  return { mode: "set", value: parseMajorToMinor(values.value) ?? 0 };
}
