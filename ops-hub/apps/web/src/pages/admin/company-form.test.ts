import { describe, expect, it } from "vitest";

import { changedFields, type CompanyProfile } from "./company-form";

const saved: CompanyProfile = {
  name: "Nile Goods",
  timezone: "Africa/Cairo",
  defaultCurrency: "EGP",
  countryCode: "EG",
  allowNegativeStock: false,
};

describe("changedFields", () => {
  it("returns nothing when nothing changed", () => {
    expect(changedFields(saved, { ...saved })).toEqual({});
  });

  it("returns only the fields that changed", () => {
    expect(
      changedFields(saved, {
        ...saved,
        defaultCurrency: "USD",
        allowNegativeStock: true,
      }),
    ).toEqual({
      defaultCurrency: "USD",
      allowNegativeStock: true,
    });
  });

  it("trims a changed name before comparing", () => {
    expect(changedFields(saved, { ...saved, name: "  Nile Goods  " })).toEqual(
      {},
    );
    expect(changedFields(saved, { ...saved, name: " Nile Trading " })).toEqual({
      name: "Nile Trading",
    });
  });
});
