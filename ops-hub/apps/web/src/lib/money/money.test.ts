import { describe, expect, it } from "vitest";

import { formatMinorAsMajor, parseMajorToMinor } from "./index";

describe("parseMajorToMinor", () => {
  it.each([
    ["149", 14900],
    ["149.5", 14950],
    ["149.05", 14905],
    [" 0.99 ", 99],
    ["0", 0],
  ])("converts %s to %d minor units", (input, expected) => {
    expect(parseMajorToMinor(input)).toBe(expected);
  });

  it("returns null for an empty field, meaning the price is unset", () => {
    expect(parseMajorToMinor("")).toBeNull();
    expect(parseMajorToMinor("   ")).toBeNull();
  });

  it.each(["abc", "-5", "1.234", "1,000", "1e3"])("rejects %s", (input) => {
    expect(() => parseMajorToMinor(input)).toThrow();
  });
});

describe("formatMinorAsMajor", () => {
  it("renders minor units as a two-decimal major amount", () => {
    expect(formatMinorAsMajor(14900)).toBe("149.00");
    expect(formatMinorAsMajor(99)).toBe("0.99");
  });

  it("renders an unset price as an empty field", () => {
    expect(formatMinorAsMajor(null)).toBe("");
  });
});
