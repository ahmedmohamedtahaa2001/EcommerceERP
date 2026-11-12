import { describe, expect, it } from "vitest";

import { utilizationPercent } from "../src/inventory/utilization";

describe("utilizationPercent", () => {
  it("is null when the location has no capacity limit", () => {
    expect(utilizationPercent(120, null)).toBeNull();
  });

  it("rounds to one decimal place", () => {
    expect(utilizationPercent(30, 60)).toBe(50);
    expect(utilizationPercent(1, 3)).toBe(33.3);
  });

  it("can exceed 100 when stock is over the configured capacity", () => {
    expect(utilizationPercent(150, 100)).toBe(150);
  });

  it("is zero for an empty location with a capacity", () => {
    expect(utilizationPercent(0, 100)).toBe(0);
  });
});
