import { describe, expect, it } from "vitest";

import {
  requireCompanyPatch,
  SUPPORTED_COUNTRIES,
  SUPPORTED_CURRENCIES,
} from "../src/company/validation";
import { CompanyValidationError } from "../src/company/errors";

describe("requireCompanyPatch", () => {
  it("accepts a valid timezone, currency and country", () => {
    expect(
      requireCompanyPatch({
        timezone: "Africa/Cairo",
        defaultCurrency: "EGP",
        countryCode: "EG",
      }),
    ).toEqual({
      timezone: "Africa/Cairo",
      defaultCurrency: "EGP",
      countryCode: "EG",
    });
  });

  it("refuses an unknown timezone", () => {
    expect(() => requireCompanyPatch({ timezone: "Mars/Olympus" })).toThrow(
      CompanyValidationError,
    );
    expect(() => requireCompanyPatch({ timezone: "" })).toThrow(
      CompanyValidationError,
    );
  });

  it("refuses a currency or country outside the supported lists", () => {
    expect(SUPPORTED_CURRENCIES).toContain("EGP");
    expect(() => requireCompanyPatch({ defaultCurrency: "egp" })).toThrow(
      CompanyValidationError,
    );
    expect(() => requireCompanyPatch({ defaultCurrency: "XYZ" })).toThrow(
      CompanyValidationError,
    );
    expect(SUPPORTED_COUNTRIES).toContain("EG");
    expect(() => requireCompanyPatch({ countryCode: "ZZ" })).toThrow(
      CompanyValidationError,
    );
  });

  it("trims and bounds the company name", () => {
    expect(requireCompanyPatch({ name: "  Nile Goods  " })).toEqual({
      name: "Nile Goods",
    });
    expect(() => requireCompanyPatch({ name: "   " })).toThrow(
      CompanyValidationError,
    );
    expect(() => requireCompanyPatch({ name: "x".repeat(121) })).toThrow(
      CompanyValidationError,
    );
  });

  it("accepts a boolean for negative stock and nothing else", () => {
    expect(requireCompanyPatch({ allowNegativeStock: true })).toEqual({
      allowNegativeStock: true,
    });
    expect(() => requireCompanyPatch({ allowNegativeStock: "yes" })).toThrow(
      CompanyValidationError,
    );
  });

  it("ignores fields it does not own and refuses an empty change", () => {
    expect(() => requireCompanyPatch({ slug: "hijack" })).toThrow(
      CompanyValidationError,
    );
  });
});
