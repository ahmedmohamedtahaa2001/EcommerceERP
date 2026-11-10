import { hash, verify } from "@node-rs/argon2";

import type { PasswordHasher } from "./types";

// Argon2id is the library default (asserted by the hash-prefix test); the
// library exports its Algorithm enum as an ambient const enum, which cannot
// be referenced under verbatimModuleSyntax.
const HASH_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const argon2Hasher: PasswordHasher = {
  hash: (password) => hash(password, HASH_OPTIONS),
  verify: async (digest, password) => {
    try {
      return await verify(digest, password);
    } catch {
      // A malformed or truncated digest is a failed verification, not a crash.
      return false;
    }
  },
};
