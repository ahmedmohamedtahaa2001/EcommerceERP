import * as XLSX from "xlsx";

import type { ImportRow, ParsedImport } from "./types";

export type { ParsedImport };

function cell(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
  }
  const lowerKeys = Object.keys(row).map((k) => k.toLowerCase());
  for (const key of keys) {
    const idx = lowerKeys.indexOf(key.toLowerCase());
    if (idx >= 0) {
      const value = Object.values(row)[idx];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
  }
  return undefined;
}

function toImages(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const str = String(value).trim();
  if (str === "") return undefined;
  if (str.startsWith("[")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // fall through to comma split
    }
  }
  return str
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toAttributes(value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && !Array.isArray(value)) {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = String(v);
    }
    return result;
  }
  const str = String(value).trim();
  if (str === "") return undefined;
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        result[k] = String(v);
      }
      return result;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function parseImportBuffer(buffer: Buffer): ParsedImport {
  let workbook: XLSX.WorkBook;
  const isXlsx = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (isXlsx) {
    try {
      workbook = XLSX.read(buffer, { type: "buffer" });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("no sheets");
      }
    } catch {
      return { rows: [], parseError: "unable to parse file; expected CSV or XLSX." };
    }
  } else {
    try {
      workbook = XLSX.read(buffer.toString("utf8"), { type: "string" });
    } catch {
      return { rows: [], parseError: "unable to parse file; expected CSV or XLSX." };
    }
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { rows: [], parseError: "unable to parse file; expected CSV or XLSX." };
    }
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], parseError: "file contains no sheets." };
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { rows: [], parseError: "file contains no sheets." };
  }
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const rows: ImportRow[] = [];
  for (let i = 0; i < json.length; i++) {
    const raw = json[i]!;
    const nameAr = cell(raw, "nameAr", "name_ar", "name ar", "arabic name");
    const nameEn = cell(raw, "nameEn", "name_en", "name en", "english name");
    const nameArStr = nameAr === undefined ? "" : String(nameAr).trim();
    const nameEnStr = nameEn === undefined ? "" : String(nameEn).trim();
    if (nameArStr === "" && nameEnStr === "") continue;

    const row: ImportRow = {
      row: i + 2,
      nameAr: nameArStr,
      nameEn: nameEnStr,
    };

    const kind = cell(raw, "kind", "type");
    if (kind !== undefined) row.kind = String(kind).trim() as import("./types").ProductKind;
    const status = cell(raw, "status");
    if (status !== undefined) row.status = String(status).trim() as import("./types").ProductStatus;
    const descriptionAr = cell(raw, "descriptionAr", "description_ar", "description ar");
    if (descriptionAr !== undefined) row.descriptionAr = String(descriptionAr).trim();
    const descriptionEn = cell(raw, "descriptionEn", "description_en", "description en");
    if (descriptionEn !== undefined) row.descriptionEn = String(descriptionEn).trim();
    const sku = cell(raw, "sku", "SKU");
    if (sku !== undefined) row.sku = String(sku).trim();
    const images = cell(raw, "images", "image", "imageUrls", "image_urls");
    const parsedImages = toImages(images);
    if (parsedImages) row.images = parsedImages;
    const attributes = cell(raw, "attributes", "attrs");
    const parsedAttrs = toAttributes(attributes);
    if (parsedAttrs) row.attributes = parsedAttrs;

    rows.push(row);
  }

  return { rows };
}
