import { describe, expect, it } from "vitest";

import { parseCapacity } from "./capacity-form";

describe("parseCapacity", () => {
  it("treats a blank field as no limit", () => {
    expect(parseCapacity("")).toBeNull();
    expect(parseCapacity("   ")).toBeNull();
  });

  it("accepts a positive whole number", () => {
    expect(parseCapacity("500")).toBe(500);
    expect(parseCapacity(" 12 ")).toBe(12);
  });

  it.each(["0", "-3", "2.5", "1e3", "abc"])("rejects %j", (input) => {
    expect(() => parseCapacity(input)).toThrow();
  });
});
