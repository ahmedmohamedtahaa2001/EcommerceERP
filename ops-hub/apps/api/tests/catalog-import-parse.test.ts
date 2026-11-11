import { utils, write } from "xlsx";
import { describe, expect, it } from "vitest";

import { parseCsv, parseXlsx } from "../src/catalog/import-parse";

describe("parseCsv", () => {
  it("parses a header and data rows into keyed records", () => {
    const content = "sku,nameEn,nameAr\nABC-1,Shirt,قميص\nABC-2,Hat,قبعة\n";
    const rows = parseCsv(content);

    expect(rows).toEqual([
      { row: 1, values: { sku: "ABC-1", nameEn: "Shirt", nameAr: "قميص" } },
      { row: 2, values: { sku: "ABC-2", nameEn: "Hat", nameAr: "قبعة" } },
    ]);
  });

  it("handles quoted fields with embedded commas and newlines", () => {
    const content =
      'sku,nameEn\n"ABC-1","Shirt, striped"\n"ABC-2","Multi\nline"\n';
    const rows = parseCsv(content);

    expect(rows[0]!.values.nameEn).toBe("Shirt, striped");
    expect(rows[1]!.values.nameEn).toBe("Multi\nline");
  });

  it("handles escaped double quotes inside a quoted field", () => {
    const content = 'sku,nameEn\n"ABC-1","He said ""hi"""\n';
    const rows = parseCsv(content);

    expect(rows[0]!.values.nameEn).toBe('He said "hi"');
  });

  it("returns an empty array for a header-only file", () => {
    expect(parseCsv("sku,nameEn\n")).toEqual([]);
  });

  it("returns an empty array for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("tolerates a file with no trailing newline", () => {
    const rows = parseCsv("sku,nameEn\nABC-1,Shirt");
    expect(rows).toEqual([
      { row: 1, values: { sku: "ABC-1", nameEn: "Shirt" } },
    ]);
  });
});

describe("parseXlsx", () => {
  it("reads the first worksheet into keyed records", () => {
    const sheet = utils.aoa_to_sheet([
      ["sku", "nameEn", "nameAr"],
      ["XLS-1", "Mug", "كوب"],
      ["XLS-2", "Cap", "كاب"],
    ]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, "Sheet1");
    const buffer = write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    const rows = parseXlsx(buffer);

    expect(rows).toEqual([
      { row: 1, values: { sku: "XLS-1", nameEn: "Mug", nameAr: "كوب" } },
      { row: 2, values: { sku: "XLS-2", nameEn: "Cap", nameAr: "كاب" } },
    ]);
  });

  it("returns an empty array for a sheet with only a header row", () => {
    const sheet = utils.aoa_to_sheet([["sku", "nameEn"]]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, "Sheet1");
    const buffer = write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;
    expect(parseXlsx(buffer)).toEqual([]);
  });
});
