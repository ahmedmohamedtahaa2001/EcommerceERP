const MAJOR_AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * Converts a major-unit amount typed by a person ("149.50") into integer minor
 * units. Money is never handled as a float: the decimal string is split and
 * the fraction is padded to two digits.
 */
export function parseMajorToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!MAJOR_AMOUNT.test(trimmed)) {
    throw new Error("price must be a positive amount with at most 2 decimals");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function formatMinorAsMajor(minor: number | null): string {
  if (minor === null) return "";
  const whole = Math.trunc(minor / 100);
  const fraction = String(minor % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}
