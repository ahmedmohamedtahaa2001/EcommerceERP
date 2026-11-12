import { describe, expect, it } from "vitest";

import { buildCustomerPayload, validateCustomerForm } from "./customer-form";

describe("validateCustomerForm", () => {
  it("requires a phone number", () => {
    expect(
      validateCustomerForm({ phone: "  ", fullName: "", email: "" }),
    ).toEqual({
      phone: "required",
    });
  });

  it("accepts a phone with a name and no email", () => {
    expect(
      validateCustomerForm({
        phone: "01012345678",
        fullName: "Sara",
        email: "",
      }),
    ).toEqual({});
  });

  it("flags an email that is not an address", () => {
    expect(
      validateCustomerForm({
        phone: "01012345678",
        fullName: "",
        email: "sara@",
      }),
    ).toEqual({ email: "invalid" });
  });
});

describe("buildCustomerPayload", () => {
  it("trims values and sends blanks as null", () => {
    expect(
      buildCustomerPayload({
        phone: " 01012345678 ",
        fullName: "  Sara  ",
        email: "   ",
      }),
    ).toEqual({ phone: "01012345678", fullName: "Sara", email: null });
  });
});
