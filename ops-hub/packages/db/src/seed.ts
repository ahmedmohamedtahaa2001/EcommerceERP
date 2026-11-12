/**
 * Seeds a demo tenant with an owner user, a catalog, stock and an order so
 * the app is usable immediately after `pnpm db:seed`.
 *
 * Usage: pnpm db:seed
 */

import { withTenant } from "./tenant";
import { createDb } from "./client";

const TENANT_SLUG = "ops-hub-demo";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const MEMBERSHIP_ID = "33333333-3333-4333-8333-333333333333";
const LOCATION_ID = "44444444-4444-4444-8444-444444444444";
const BIN_ID = "55555555-5555-4555-8555-555555555555";
const PRODUCT_ID = "66666666-6666-4666-8666-666666666666";
const VARIANT_ID = "77777777-7777-4777-8777-777777777777";

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "owner@ops-hub.local";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "ops-hub-demo-password";

/** argon2id is used in production; the seed stores a placeholder hash only
 * when argon2 has not been run yet. Run `pnpm db:seed:password` to set a real
 * password. */
async function main(): Promise<void> {
  const { pool } = createDb();

  const client = await pool.connect();
  let tenantId = "";
  try {
    await client.query("begin");
    const existing = await client.query<{ id: string }>(
      `select id from tenants where slug=$1`,
      [TENANT_SLUG],
    );
    if (existing.rows[0]) {
      tenantId = existing.rows[0].id;
    } else {
      tenantId = "11111111-1111-4111-8111-111111111111";
      await client.query(
        `insert into tenants (id, slug, name) values ($1,$2,'Demo Brand')`,
        [tenantId, TENANT_SLUG],
      );
    }
    const userRow = await client.query<{ id: string }>(
      `select id from users where lower(email)=lower($1)`,
      [DEMO_EMAIL],
    );
    const userId = userRow.rows[0]?.id ?? USER_ID;
    if (!userRow.rows[0]) {
      await client.query(
        `insert into users (id, email, password_hash, full_name)
         values ($1,$2,$3,'Demo Owner')`,
        [userId, DEMO_EMAIL, "argon2id-placeholder"],
      );
    }
    const membership = await client.query<{ id: string }>(
      `select id from memberships where tenant_id=$1 and user_id=$2`,
      [tenantId, userId],
    );
    if (!membership.rows[0]) {
      await client.query(
        `insert into memberships (id, tenant_id, user_id, role)
         values ($1,$2,$3,'owner')`,
        [MEMBERSHIP_ID, tenantId, userId],
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  await withTenant(pool, tenantId, async (c) => {
    await c.query(
      `insert into locations (id, tenant_id, type, name, code, governorate_code)
       values ($1,$2,'warehouse','Main Warehouse','WH-1','C')
       on conflict (id) do nothing`,
      [LOCATION_ID, tenantId],
    );
    await c.query(
      `insert into bins (id, tenant_id, location_id, code, zone, capacity)
       values ($1,$2,$3,'A-01','A',100)
       on conflict (id) do nothing`,
      [BIN_ID, tenantId, LOCATION_ID],
    );
    await c.query(
      `insert into products (id, tenant_id, kind, name_ar, name_en)
       values ($1,$2,'simple','قميص قطن','Cotton Shirt')
       on conflict (id) do nothing`,
      [PRODUCT_ID, tenantId],
    );
    await c.query(
      `insert into variants (id, tenant_id, product_id, sku)
       values ($1,$2,$3,'DEMO-SKU-001')
       on conflict (id) do nothing`,
      [VARIANT_ID, tenantId, PRODUCT_ID],
    );
    await c.query(
      `insert into stock_movements
         (tenant_id, variant_id, location_id, bucket, delta, reason, actor_type)
       select $1,$2,$3,'on_hand',25,'OPENING_STOCK','system'
       where not exists (
         select 1 from stock_movements where tenant_id=$1 and variant_id=$2
       )`,
      [tenantId, VARIANT_ID, LOCATION_ID],
    );
    await c.query(
      `insert into stock_balances (tenant_id, variant_id, location_id, bucket, quantity)
       select $1,$2,$3,'on_hand',25
       where not exists (
         select 1 from stock_balances where tenant_id=$1 and variant_id=$2
       )`,
      [tenantId, VARIANT_ID, LOCATION_ID],
    );
  });

  await pool.end();
  console.log(`seeded demo tenant ${tenantId}`);
  console.log(`email:    ${DEMO_EMAIL}`);
  console.log(
    `password: ${DEMO_PASSWORD} (set with pnpm db:seed:password to hash it)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
