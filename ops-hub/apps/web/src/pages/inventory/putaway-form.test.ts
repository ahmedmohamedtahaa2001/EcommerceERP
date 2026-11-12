import { describe, expect, it } from "vitest";

import { validatePutaway } from "./putaway-form";

describe("validatePutaway", () => {
  it("accepts a chosen SKU, bin and a whole quantity", () => {
    expect(
      validatePutaway({ variantId: "v1", binId: "b1", quantity: "4" }),
    ).toEqual({});
  });

  it("requires a SKU and a bin", () => {
    expect(
      validatePutaway({ variantId: "", binId: "", quantity: "1" }),
    ).toEqual({
      variantId: "required",
      binId: "required",
    });
  });

  it.each(["", "0", "-2", "1.5", "abc"])("rejects quantity %j", (quantity) => {
    expect(validatePutaway({ variantId: "v1", binId: "b1", quantity })).toEqual(
      {
        quantity: "invalid",
      },
    );
  });
});
