import { describe, expect, it } from "vitest";

import { buildPriceChange, validatePriceChange } from "./bulk-form";

describe("validatePriceChange", () => {
  it("accepts a percentage between -90 and 1000", () => {
    expect(validatePriceChange({ mode: "percent", value: "-15" })).toEqual({});
    expect(validatePriceChange({ mode: "percent", value: "250" })).toEqual({});
  });

  it("rejects a percentage outside the range or not a number", () => {
    expect(validatePriceChange({ mode: "percent", value: "-95" })).toEqual({
      value: "percentRange",
    });
    expect(validatePriceChange({ mode: "percent", value: "abc" })).toEqual({
      value: "number",
    });
    expect(validatePriceChange({ mode: "percent", value: "" })).toEqual({
      value: "number",
    });
  });

  it("accepts a fixed price with up to two decimals and rejects more", () => {
    expect(validatePriceChange({ mode: "set", value: "149.50" })).toEqual({});
    expect(validatePriceChange({ mode: "set", value: "1.234" })).toEqual({
      value: "price",
    });
    expect(validatePriceChange({ mode: "set", value: "-5" })).toEqual({
      value: "price",
    });
  });
});

describe("buildPriceChange", () => {
  it("sends a percentage as a number", () => {
    expect(buildPriceChange({ mode: "percent", value: "12.5" })).toEqual({
      mode: "percent",
      value: 12.5,
    });
  });

  it("converts a fixed price to minor units", () => {
    expect(buildPriceChange({ mode: "set", value: "149.50" })).toEqual({
      mode: "set",
      value: 14950,
    });
  });
});
