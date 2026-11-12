import { createHash } from "node:crypto";

/** Stringifies with object keys sorted recursively, so two objects that are
 * equal except for key order still hash the same. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** A stable hash of a request body, used to tell a true idempotent retry
 * (same key, same body) apart from a reused key with a different body. */
export function hashRequestBody(body: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(body)))
    .digest("hex");
}
