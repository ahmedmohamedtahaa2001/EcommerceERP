import { read, utils } from "xlsx";

export interface ImportRow {
  /** 1-indexed position among the data rows (header excluded). */
  row: number;
  values: Record<string, string>;
}

/**
 * A minimal RFC 4180 CSV parser: quoted fields, escaped `""`, and commas or
 * newlines inside quotes. The first row is the header; its cells become the
 * keys of every following row.
 */
export function parseCsv(content: string): ImportRow[] {
  const records = parseCsvRecords(content);
  if (records.length === 0) {
    return [];
  }
  const header = records[0]!;
  return records.slice(1).map((cells, index) => ({
    row: index + 1,
    values: toRecord(header, cells),
  }));
}

/** Reads the first worksheet of an XLSX workbook into header-keyed rows. */
export function parseXlsx(buffer: Buffer): ImportRow[] {
  const workbook = read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return [];
  }
  const rows: unknown[][] = utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (rows.length === 0) {
    return [];
  }
  const header = rows[0]!.map((cell) => String(cell));
  return rows.slice(1).map((cells, index) => ({
    row: index + 1,
    values: toRecord(
      header,
      cells.map((cell) => (cell === undefined ? "" : String(cell))),
    ),
  }));
}

function toRecord(header: string[], cells: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  header.forEach((key, i) => {
    record[key.trim()] = (cells[i] ?? "").trim();
  });
  return record;
}

function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    records.push(row);
    row = [];
  };

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Trailing field/row (file may or may not end with a newline).
  if (field !== "" || row.length > 0) {
    pushRow();
  }

  return records.filter((record) => record.some((cell) => cell !== ""));
}
