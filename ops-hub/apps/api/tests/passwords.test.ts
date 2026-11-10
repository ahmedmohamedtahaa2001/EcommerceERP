import { describe, expect, it } from "vitest";

import { argon2Hasher } from "../src/auth/passwords";

describe("argon2Hasher", () => {
  it("hashes with argon2id and verifies the original password", async () => {
    const digest = await argon2Hasher.hash("correct-horse");

    expect(digest.startsWith("$argon2id$")).toBe(true);
    expect(digest).not.toContain("correct-horse");
    await expect(argon2Hasher.verify(digest, "correct-horse")).resolves.toBe(
      true,
    );
    await expect(argon2Hasher.verify(digest, "wrong")).resolves.toBe(false);
  });

  it("treats a malformed digest as a failed verification", async () => {
    await expect(argon2Hasher.verify("not-a-hash", "anything")).resolves.toBe(
      false,
    );
  });
});
