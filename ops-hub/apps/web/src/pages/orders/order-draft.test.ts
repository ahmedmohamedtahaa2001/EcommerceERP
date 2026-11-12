import { describe, expect, it } from "vitest";

import {
  addLine,
  lineErrorsOf,
  buildCreateOrderPayload,
  emptyDraft,
  parseQuantity,
  subtotalMinor,
  validateOrderDraft,
  type OrderDraft,
} from "./order-draft";

function validDraft(): OrderDraft {
  return {
    ...emptyDraft(),
    phone: "01012345678",
    fullName: "Sara",
    line1: "12 Tahrir St",
    governorate: "Cairo",
    lines: [
      {
        sku: "SHIRT-M",
        productName: "Cotton Shirt",
        quantity: "2",
        unitPrice: "149.50",
        currency: "EGP",
      },
    ],
  };
}

describe("validateOrderDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateOrderDraft(validDraft())).toEqual({ lines: [{}] });
  });

  it("requires a customer phone, a street line, a governorate and at least one line", () => {
    const errors = validateOrderDraft({ ...emptyDraft() });
    expect(errors.phone).toBe("required");
    expect(errors.line1).toBe("required");
    expect(errors.governorate).toBe("required");
    expect(errors.lines).toBe("empty");
  });

  it("rejects a quantity that is not a positive whole number", () => {
    const draft = validDraft();
    draft.lines[0]!.quantity = "1.5";
    expect(lineErrorsOf(validateOrderDraft(draft))[0]?.quantity).toBe(
      "invalid",
    );
    draft.lines[0]!.quantity = "0";
    expect(lineErrorsOf(validateOrderDraft(draft))[0]?.quantity).toBe(
      "invalid",
    );
  });

  it("rejects a missing or malformed unit price", () => {
    const draft = validDraft();
    draft.lines[0]!.unitPrice = "";
    expect(lineErrorsOf(validateOrderDraft(draft))[0]?.unitPrice).toBe(
      "required",
    );
    draft.lines[0]!.unitPrice = "12.345";
    expect(lineErrorsOf(validateOrderDraft(draft))[0]?.unitPrice).toBe(
      "invalid",
    );
  });
});

describe("parseQuantity", () => {
  it("accepts positive whole numbers only", () => {
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity(" 10 ")).toBe(10);
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("-1")).toBeNull();
    expect(parseQuantity("2.5")).toBeNull();
    expect(parseQuantity("")).toBeNull();
  });
});

describe("subtotalMinor", () => {
  it("sums quantity times unit price in minor units", () => {
    const draft = validDraft();
    draft.lines.push({
      sku: "SOCKS",
      productName: "Socks",
      quantity: "3",
      unitPrice: "20",
      currency: "EGP",
    });
    expect(subtotalMinor(draft)).toBe(2 * 14950 + 3 * 2000);
  });
});

describe("addLine", () => {
  it("starts a line from a variant with its list price", () => {
    const draft = addLine(emptyDraft(), {
      sku: "SHIRT-L",
      productName: "Cotton Shirt",
      priceMinor: 14900,
      currency: "EGP",
    });
    expect(draft.lines).toEqual([
      {
        sku: "SHIRT-L",
        productName: "Cotton Shirt",
        quantity: "1",
        unitPrice: "149.00",
        currency: "EGP",
      },
    ]);
  });

  it("leaves the price blank when the variant is unpriced", () => {
    const draft = addLine(emptyDraft(), {
      sku: "SHIRT-XL",
      productName: "Cotton Shirt",
      priceMinor: null,
      currency: "EGP",
    });
    expect(draft.lines[0]!.unitPrice).toBe("");
  });
});

describe("buildCreateOrderPayload", () => {
  it("maps the draft to the API shape and drops blank optional fields", () => {
    const payload = buildCreateOrderPayload({
      ...validDraft(),
      fullName: "",
      line2: "  ",
      city: "",
      channel: "",
      externalOrderId: "",
    });
    expect(payload).toEqual({
      customer: { phone: "01012345678" },
      address: { line1: "12 Tahrir St", governorate: "Cairo" },
      lines: [
        { sku: "SHIRT-M", quantity: 2, unitPriceMinor: 14950, currency: "EGP" },
      ],
      payment: { method: "cod" },
      channel: "manual",
    });
  });

  it("keeps optional values that were filled in", () => {
    const payload = buildCreateOrderPayload({
      ...validDraft(),
      line2: "Flat 4",
      city: "Nasr City",
      paymentMethod: "prepaid",
      channel: "whatsapp",
      externalOrderId: "WA-881",
    });
    expect(payload.customer).toEqual({
      phone: "01012345678",
      fullName: "Sara",
    });
    expect(payload.address).toEqual({
      line1: "12 Tahrir St",
      line2: "Flat 4",
      city: "Nasr City",
      governorate: "Cairo",
    });
    expect(payload.payment).toEqual({ method: "prepaid" });
    expect(payload.channel).toBe("whatsapp");
    expect(payload.externalOrderId).toBe("WA-881");
  });
});
