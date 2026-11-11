import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgAuditReader, PgAuditWriter } from "../src/audit/pg";
import type { AuditEntryRecord } from "../src/audit/types";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000000201";
const tenantB = "00000000-0000-4000-8000-000000000202";
const objectId = "00000000-0000-4000-8000-000000000c01";

const client = new Client({ connectionString: databaseUrl });
const pool = new Pool({ connectionString: databaseUrl });
const auditWriter = new PgAuditWriter(pool);
const auditReader = new PgAuditReader(pool);

describe.skipIf(!runDbTests)("audit_log against Postgres", () => {
  let written: AuditEntryRecord | undefined;

  beforeAll(async () => {
    await client.connect();
    await client.query("delete from audit_log where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'aud-a', 'Tenant A'), ($2, 'aud-b', 'Tenant B')",
      [tenantA, tenantB],
    );
  });

  afterAll(async () => {
    await client.query("delete from audit_log where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.end();
    await pool.end();
  });

  it("writes and reads an entry with before/after state", async () => {
    await auditWriter.record({
      tenantId: tenantA,
      actorType: "user",
      actorId: "11111111-1111-4111-8111-111111111111",
      action: "api_key.created",
      objectType: "api_key",
      objectId,
      before: null,
      after: { name: "storefront", scopes: ["orders:read"] },
    });

    const entries = await auditReader.list(tenantA, {
      objectType: "api_key",
      objectId,
      limit: 50,
    });

    expect(entries).toHaveLength(1);
    written = entries[0];
    expect(written).toMatchObject({
      tenantId: tenantA,
      actorType: "user",
      action: "api_key.created",
      objectType: "api_key",
      objectId,
    });
    expect(written?.after).toEqual({
      name: "storefront",
      scopes: ["orders:read"],
    });
  });

  it("never exposes another tenant's entries", async () => {
    const entries = await auditReader.list(tenantB, { limit: 50 });
    expect(entries).toEqual([]);
  });

  it("fails closed for the app role without tenant scope", async () => {
    await client.query("begin");
    await client.query("set local role ops_hub_app");
    const result = await client.query<{ count: number }>(
      "select count(*)::int as count from audit_log",
    );
    await client.query("commit");

    expect(result.rows[0]?.count).toBe(0);
  });

  it("rejects updates to the append-only log for the app role", async () => {
    expect(written).toBeDefined();
    await client.query("begin");
    await client.query("set local role ops_hub_app");
    await client.query("select set_config('app.tenant_id', $1, true)", [
      tenantA,
    ]);
    await expect(
      client.query("update audit_log set action = 'tampered' where id = $1", [
        written!.id,
      ]),
    ).rejects.toThrow();
    await client.query("rollback");
  });
});
