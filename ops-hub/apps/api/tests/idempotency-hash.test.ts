import { describe, expect, it } from "vitest";

import { hashRequestBody } from "../src/orders/idempotency-hash";

describe("hashRequestBody", () => {
  it("is stable regardless of key order", () => {
    const a = hashRequestBody({ a: 1, b: { x: 1, y: 2 } });
    const b = hashRequestBody({ b: { y: 2, x: 1 }, a: 1 });
    expect(a).toBe(b);
  });

  it("differs when a value differs", () => {
    const a = hashRequestBody({ quantity: 1 });
    const b = hashRequestBody({ quantity: 2 });
    expect(a).not.toBe(b);
  });

  it("differs when array order differs", () => {
    const a = hashRequestBody({ lines: [{ sku: "A" }, { sku: "B" }] });
    const b = hashRequestBody({ lines: [{ sku: "B" }, { sku: "A" }] });
    expect(a).not.toBe(b);
  });

  it("produces the same hash for the same input across calls", () => {
    const input = {
      customer: { phone: "+201012345678" },
      lines: [{ sku: "A", quantity: 2 }],
    };
    expect(hashRequestBody(input)).toBe(hashRequestBody(input));
  });
});
