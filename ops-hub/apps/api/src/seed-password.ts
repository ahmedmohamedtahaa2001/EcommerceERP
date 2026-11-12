/**
 * Sets the password of the seeded demo user using the same argon2id hasher
 * the API uses.
 *
 * Usage: pnpm db:seed:password [email] [password]
 */

import { createDb } from "@ops-hub/db";

import { argon2Hasher } from "./auth/passwords";

if (process.env.NODE_ENV === "production") {
  throw new Error("Demo seed data must never run in production.");
}

const DEMO_EMAIL =
  process.argv[2] ?? process.env.DEMO_EMAIL ?? "owner@ops-hub.local";
const DEMO_PASSWORD =
  process.argv[3] ?? process.env.DEMO_PASSWORD ?? "ops-hub-demo-password";

async function main(): Promise<void> {
  const { pool } = createDb();
  const hash = await argon2Hasher.hash(DEMO_PASSWORD);
  const result = await pool.query(
    "update users set password_hash=$1 where lower(email)=lower($2) returning id",
    [hash, DEMO_EMAIL],
  );
  await pool.end();
  if (result.rowCount === 0) {
    throw new Error(`no user with email ${DEMO_EMAIL}`);
  }
  console.log(`password set for ${DEMO_EMAIL}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
