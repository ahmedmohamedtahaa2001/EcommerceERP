import { describe, expect, it } from "vitest";

import { toCsv } from "../src/exports/csv";

describe("toCsv", () => {
  it("writes a header and CRLF-terminated rows", () => {
    expect(toCsv(["sku", "qty"], [["A-1", 2]])).toBe("sku,qty\r\nA-1,2\r\n");
  });

  it("quotes fields with commas, quotes or line breaks and doubles inner quotes", () => {
    expect(toCsv(["name"], [['Shirt, "cotton"\nline two']])).toBe(
      'name\r\n"Shirt, ""cotton""\nline two"\r\n',
    );
  });

  it("writes empty cells for null and undefined", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,\r\n");
  });

  it.each(["=SUM(A1:A2)", "+1", "-2", "@cmd", "\t tab", "\rcr"])(
    "neutralizes spreadsheet formula injection in %j",
    (value) => {
      const [, row] = toCsv(["v"], [[value]]).split("\r\n");
      expect(row!.startsWith("'") || row!.startsWith('"')).toBe(true);
      expect(row).not.toMatch(/^[=+\-@\t\r]/);
    },
  );

  it("keeps ordinary negative numbers as numbers", () => {
    expect(toCsv(["delta"], [[-5]])).toBe("delta\r\n-5\r\n");
  });
});
