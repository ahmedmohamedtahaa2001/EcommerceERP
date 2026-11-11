import { createHash, randomBytes } from "node:crypto";

/** Every Ops Hub API key starts with this prefix so it is recognizable. */
export const API_KEY_PREFIX = "ohk_";

/** Characters of the secret (including the prefix) exposed for display. */
export const KEY_PREFIX_LENGTH = API_KEY_PREFIX.length + 8;

export interface GeneratedApiKey {
  /** The full plaintext secret, shown exactly once at creation. */
  secret: string;
  /** Non-secret leading slice used for display and revocation UIs. */
  prefix: string;
  /** SHA-256 hex digest stored at rest; the plaintext is never persisted. */
  hash: string;
}

/**
 * API keys are high-entropy random secrets, so a fast SHA-256 digest is the
 * right hash at rest: authentication is a single indexed lookup, not a
 * password check. Password hashing (argon2id) stays in the auth module.
 */
export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const secret = API_KEY_PREFIX + randomBytes(24).toString("base64url");
  return { secret, prefix: secret.slice(0, KEY_PREFIX_LENGTH), hash: hashApiKey(secret) };
}

export function isApiKeySecret(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX);
}
