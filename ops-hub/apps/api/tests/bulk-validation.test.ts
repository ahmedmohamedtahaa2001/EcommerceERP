import { describe, expect, it } from "vitest";

import {
  requireIds,
  requirePriceChange,
  MAX_BULK_ITEMS,
} from "../src/bulk/validation";
import { BulkValidationError } from "../src/bulk/errors";

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b2";

describe("requireIds", () => {
  it("dedupes while keeping the order", () => {
    expect(requireIds([A, B, A])).toEqual([A, B]);
  });

  it("rejects empty, non-array, non-uuid and oversized lists", () => {
    expect(() => requireIds([])).toThrow(BulkValidationError);
    expect(() => requireIds("x")).toThrow(BulkValidationError);
    expect(() => requireIds(["not-an-id"])).toThrow(BulkValidationError);
    const many = Array.from(
      { length: MAX_BULK_ITEMS + 1 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(() => requireIds(many)).toThrow(BulkValidationError);
  });
});

describe("requirePriceChange", () => {
  it("accepts a percentage change within bounds", () => {
    expect(requirePriceChange({ mode: "percent", value: 10 })).toEqual({
      mode: "percent",
      value: 10,
    });
    expect(requirePriceChange({ mode: "percent", value: -25 })).toEqual({
      mode: "percent",
      value: -25,
    });
  });

  it("refuses a percentage that would take a price below -90% or above +1000%", () => {
    expect(() => requirePriceChange({ mode: "percent", value: -100 })).toThrow(
      BulkValidationError,
    );
    expect(() => requirePriceChange({ mode: "percent", value: 1001 })).toThrow(
      BulkValidationError,
    );
  });

  it("accepts a fixed price in minor units and refuses fractions or negatives", () => {
    expect(requirePriceChange({ mode: "set", value: 14900 })).toEqual({
      mode: "set",
      value: 14900,
    });
    expect(() => requirePriceChange({ mode: "set", value: 149.5 })).toThrow(
      BulkValidationError,
    );
    expect(() => requirePriceChange({ mode: "set", value: -1 })).toThrow(
      BulkValidationError,
    );
  });

  it("refuses an unknown mode or a non-number value", () => {
    expect(() => requirePriceChange({ mode: "multiply", value: 2 })).toThrow(
      BulkValidationError,
    );
    expect(() => requirePriceChange({ mode: "set", value: "100" })).toThrow(
      BulkValidationError,
    );
  });
});
