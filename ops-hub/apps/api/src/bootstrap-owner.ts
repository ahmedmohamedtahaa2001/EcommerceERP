/**
 * Creates the first business and its owner account on a live system, where the
 * demo seed is refused. Run once per business:
 *
 *   BOOTSTRAP_BUSINESS_NAME="Nile Goods" BOOTSTRAP_EMAIL=owner@nile.example \
 *   BOOTSTRAP_PASSWORD='a-long-initial-password' pnpm bootstrap:owner
 *
 * The owner should change the password after the first login.
 */
import { randomUUID } from "node:crypto";

import { createDb } from "@ops-hub/db";

import { argon2Hasher } from "./auth/passwords";

const MIN_PASSWORD_LENGTH = 12;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function main(): Promise<void> {
  const businessName = required("BOOTSTRAP_BUSINESS_NAME");
  const email = required("BOOTSTRAP_EMAIL").toLowerCase();
  const password = required("BOOTSTRAP_PASSWORD");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `BOOTSTRAP_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  const slug = slugify(businessName);
  if (slug === "") {
    throw new Error("BOOTSTRAP_BUSINESS_NAME must contain letters or digits.");
  }

  const { pool } = createDb();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const taken = await client.query(`select 1 from tenants where slug = $1`, [
      slug,
    ]);
    if ((taken.rowCount ?? 0) > 0) {
      throw new Error(
        `A business with the identifier "${slug}" already exists.`,
      );
    }
    const existingUser = await client.query(
      `select 1 from users where lower(email) = $1`,
      [email],
    );
    if ((existingUser.rowCount ?? 0) > 0) {
      throw new Error("An account already exists for this email.");
    }

    const tenantId = randomUUID();
    const userId = randomUUID();
    await client.query(
      `insert into tenants (id, slug, name) values ($1, $2, $3)`,
      [tenantId, slug, businessName],
    );
    await client.query(
      `insert into users (id, email, full_name, password_hash) values ($1, $2, $3, $4)`,
      [userId, email, "Owner", await argon2Hasher.hash(password)],
    );
    await client.query(
      `insert into memberships (tenant_id, user_id, role, active) values ($1, $2, 'owner', true)`,
      [tenantId, userId],
    );
    await client.query("commit");
    console.log(
      `Created business "${businessName}" (${slug}) with owner ${email}.`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
