export type CsvCell = string | number | boolean | Date | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Renders a cell as text. Values that a spreadsheet would read as a formula
 * are prefixed with an apostrophe, so an exported product name can't run code
 * when someone opens the file.  Numbers are never prefixed.
 */
function renderCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = value instanceof Date ? value.toISOString() : value;
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) || /^\s|\s$/.test(safe)
    ? `"${safe.replace(/"/g, '""')}"`
    : safe;
}

export function toCsv(
  header: readonly string[],
  rows: readonly CsvCell[][],
): string {
  const lines = [header, ...rows].map((row) => row.map(renderCell).join(","));
  return lines.map((line) => `${line}\r\n`).join("");
}
