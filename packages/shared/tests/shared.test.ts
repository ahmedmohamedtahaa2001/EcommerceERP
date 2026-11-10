import { describe, expect, it } from "vitest";

import {
  createMoney,
  addMoney,
  CurrencyMismatchError,
  InvalidMoneyError,
  InvalidPhoneError,
  normalizePhone,
  systemClock,
  translate,
} from "../src/index";

describe("normalizePhone", () => {
  it.each([
    ["01012345678", "+201012345678"],
    ["+201012345678", "+201012345678"],
    ["0020 10 1234 5678", "+201012345678"],
    ["0101 234 5678", "+201012345678"],
    ["011 2345 6789", "+201123456789"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "not-a-phone", "+2010123456", "+2010123456789", "0512345678"])(
    "rejects %s",
    (input) => {
      expect(() => normalizePhone(input)).toThrow(InvalidPhoneError);
    },
  );
});

describe("money", () => {
  it("stores integer minor units with a currency", () => {
    expect(createMoney(1500, "EGP")).toEqual({
      amountMinor: 1500,
      currency: "EGP",
    });
  });

  it("allows negative amounts for refunds", () => {
    expect(createMoney(-250, "EGP").amountMinor).toBe(-250);
  });

  it.each([15.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-integer amount %s",
    (amount) => {
      expect(() => createMoney(amount, "EGP")).toThrow(InvalidMoneyError);
    },
  );

  it("adds amounts in the same currency", () => {
    expect(addMoney(createMoney(1000, "EGP"), createMoney(250, "EGP"))).toEqual(
      { amountMinor: 1250, currency: "EGP" },
    );
  });

  it("rejects adding different currencies", () => {
    expect(() =>
      addMoney(createMoney(1000, "EGP"), createMoney(1000, "USD")),
    ).toThrow(CurrencyMismatchError);
  });
});

describe("systemClock", () => {
  it("returns the current time", () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    const after = Date.now();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});

describe("translate", () => {
  it("returns English and Arabic text for the same key", () => {
    const en = translate("en", "errors.invalid_phone");
    const ar = translate("ar", "errors.invalid_phone");

    expect(en).not.toBe("");
    expect(ar).not.toBe("");
    expect(ar).not.toBe(en);
  });
});
