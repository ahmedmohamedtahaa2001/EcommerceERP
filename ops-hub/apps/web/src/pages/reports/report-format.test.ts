import { formatMoney } from "../../lib/format";
import { describe, expect, it } from "vitest";

import { formatKpi, isoDay } from "./report-format";

describe("formatKpi", () => {
  it("renders counts as whole numbers", () => {
    expect(formatKpi(12.4, "count", "EGP")).toBe("12");
  });

  it("renders percents with one decimal", () => {
    expect(formatKpi(96.66, "percent", "EGP")).toBe("96.7%");
  });

  it("renders hours with one decimal", () => {
    expect(formatKpi(4.25, "hours", "EGP")).toBe("4.3");
  });

  it("renders money from minor units in the business currency", () => {
    expect(formatKpi(14950, "minor", "EGP")).toBe(formatMoney(14950, "EGP"));
  });
});

describe("isoDay", () => {
  it("formats the local calendar day as YYYY-MM-DD", () => {
    expect(isoDay(new Date(2026, 10, 5, 23, 30))).toBe("2026-11-05");
  });
});
