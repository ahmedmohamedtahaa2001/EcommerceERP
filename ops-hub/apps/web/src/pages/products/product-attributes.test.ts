import { describe, expect, it } from "vitest";

import { parseTags } from "./product-attributes";

describe("parseTags", () => {
  it("splits on commas, trims, drops blanks and removes duplicates", () => {
    expect(parseTags(" summer, cotton ,, summer ")).toEqual([
      "summer",
      "cotton",
    ]);
  });

  it("returns an empty list for an empty field", () => {
    expect(parseTags("")).toEqual([]);
  });
});
