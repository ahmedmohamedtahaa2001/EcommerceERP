const WHOLE_NUMBER = /^\d+$/;

/** Blank means no limit. The API enforces the same rule; this gives the field error early. */
export function parseCapacity(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!WHOLE_NUMBER.test(trimmed) || Number(trimmed) <= 0) {
    throw new Error("capacity must be a positive whole number");
  }
  return Number(trimmed);
}

/** True when the field can be submitted as typed (blank or a valid capacity). */
export function capacityIsValid(input: string): boolean {
  try {
    parseCapacity(input);
    return true;
  } catch {
    return false;
  }
}
