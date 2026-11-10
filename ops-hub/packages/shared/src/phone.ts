import { InvalidPhoneError } from "./errors";

const ALLOWED_INPUT = /^\+?[\d\s().-]+$/;
const EGYPTIAN_MOBILE = /^\+20(10|11|12|15)\d{8}$/;

/**
 * Normalizes an Egyptian mobile number to E.164 (`+20XXXXXXXXXX`).
 * Accepts local (`01012345678`), international (`+201012345678`), and
 * `00`-prefixed (`0020 10 1234 5678`) forms. Callers keep the raw input for
 * audit rather than relying on this function to preserve formatting.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!ALLOWED_INPUT.test(trimmed) || trimmed === "") {
    throw new InvalidPhoneError(raw);
  }

  const digits = trimmed.replace(/[\s().-]/g, "");
  let e164: string;

  if (digits.startsWith("+")) {
    e164 = digits;
  } else if (digits.startsWith("0020")) {
    e164 = `+${digits.slice(2)}`;
  } else if (digits.startsWith("20")) {
    e164 = `+${digits}`;
  } else if (digits.startsWith("0")) {
    e164 = `+20${digits.slice(1)}`;
  } else {
    e164 = `+20${digits}`;
  }

  if (!EGYPTIAN_MOBILE.test(e164)) {
    throw new InvalidPhoneError(raw);
  }
  return e164;
}
