import { describe, expect, it } from "vitest";

import { filenameFromDisposition } from "./download";

describe("filenameFromDisposition", () => {
  it("reads a quoted filename", () => {
    expect(
      filenameFromDisposition(
        'attachment; filename="orders-2026-11-12.csv"',
        "x.csv",
      ),
    ).toBe("orders-2026-11-12.csv");
  });

  it("falls back when the header is missing or has no filename", () => {
    expect(filenameFromDisposition(null, "orders.csv")).toBe("orders.csv");
    expect(filenameFromDisposition("attachment", "orders.csv")).toBe(
      "orders.csv",
    );
  });
});
