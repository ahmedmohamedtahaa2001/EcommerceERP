import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantA = "00000000-0000-4000-8000-00000000000a";
const tenantB = "00000000-0000-4000-8000-00000000000b";
const testEmail = "rls-test-user@example.com";

let userId = "";

const client = new Client({ connectionString: databaseUrl });

async function asTenant<T>(
  tenantId: string | null,
  work: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  await client.query("set local role ops_hub_app");
  if (tenantId !== null) {
    await client.query("select set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
  }
  try {
    const result = await work();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

describe.skipIf(!runDbTests)("row-level security", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query(
      "delete from memberships where tenant_id in ($1, $2)",
      [tenantA, tenantB],
    );
    await client.query("delete from audit_log where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from users where email = $1", [testEmail]);
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);

    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'rls-a', 'Tenant A'), ($2, 'rls-b', 'Tenant B')",
      [tenantA, tenantB],
    );
    const user = await client.query<{ id: string }>(
      "insert into users (email) values ($1) returning id",
      [testEmail],
    );
    userId = user.rows[0]?.id ?? "";

    for (const tenantId of [tenantA, tenantB]) {
      await client.query(
        "insert into memberships (tenant_id, user_id, role) values ($1, $2, 'owner')",
        [tenantId, userId],
      );
      await client.query(
        "insert into audit_log (tenant_id, actor_type, action, object_type, object_id) values ($1, 'system', 'seed', 'tenant', $2)",
        [tenantId, tenantId],
      );
    }
  });

  afterAll(async () => {
    await client.query("reset role");
    await client.query(
      "delete from memberships where tenant_id in ($1, $2)",
      [tenantA, tenantB],
    );
    await client.query("delete from audit_log where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from users where email = $1", [testEmail]);
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.end();
  });

  it("enables row-level security on every tenant-scoped table", async () => {
    const result = await client.query<{ relname: string }>(
      "select relname from pg_class where relname = any($1) and relrowsecurity",
      [["tenants", "memberships", "audit_log"]],
    );
    expect(result.rows.map((row) => row.relname).sort()).toEqual([
      "audit_log",
      "memberships",
      "tenants",
    ]);
  });

  it("shows only the scoped tenant's rows", async () => {
    const tenants = await asTenant(tenantA, async () => {
      const scoped = await client.query<{ id: string }>(
        "select id from tenants order by id",
      );
      const memberships = await client.query<{ tenant_id: string }>(
        "select distinct tenant_id from memberships",
      );
      const audit = await client.query<{ tenant_id: string }>(
        "select distinct tenant_id from audit_log",
      );
      return { scoped, memberships, audit };
    });

    expect(tenants.scoped.rows).toEqual([{ id: tenantA }]);
    expect(tenants.memberships.rows).toEqual([{ tenant_id: tenantA }]);
    expect(tenants.audit.rows).toEqual([{ tenant_id: tenantA }]);
  });

  it("cannot read another tenant even when its id is known", async () => {
    const count = await asTenant(tenantA, async () => {
      const result = await client.query<{ count: number }>(
        "select count(*)::int as count from tenants where id = $1",
        [tenantB],
      );
      return result.rows[0]?.count;
    });

    expect(count).toBe(0);
  });

  it("fails closed when no tenant is set", async () => {
    const counts = await asTenant(null, async () => {
      const result = await client.query<{
        tenants: number;
        memberships: number;
        audit_log: number;
      }>(
        "select (select count(*)::int from tenants) as tenants, (select count(*)::int from memberships) as memberships, (select count(*)::int from audit_log) as audit_log",
      );
      return result.rows[0];
    });

    expect(counts).toEqual({ tenants: 0, memberships: 0, audit_log: 0 });
  });
});
