import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { InvalidApiKeyError } from "../src/api-keys/errors";
import { hashApiKey } from "../src/api-keys/keys";
import { PgApiKeyStore } from "../src/api-keys/pg-store";
import { ApiKeyService } from "../src/api-keys/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantA = "00000000-0000-4000-8000-00000000000a";
const tenantB = "00000000-0000-4000-8000-00000000000b";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const store = new PgApiKeyStore(pool);
const service = new ApiKeyService({ store, clock: systemClock });

async function asAppTenant<T>(
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

describe.skipIf(!runDbTests)("API key store against Postgres", () => {
  let created: { id: string; secret: string } | undefined;

  beforeAll(async () => {
    await client.connect();
    await client.query("delete from api_keys where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'ak-a', 'Tenant A'), ($2, 'ak-b', 'Tenant B')",
      [tenantA, tenantB],
    );
  });

  afterAll(async () => {
    await client.query("reset role");
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.end();
    await pool.end();
  });

  it("round-trips a key: create, lookup by hash, authenticate", async () => {
    const result = await service.create(
      { name: "storefront", scopes: ["orders:read"] },
      { kind: "apiKey", id: "bootstrap" },
      tenantA,
    );
    created = { id: result.summary.id, secret: result.secret };

    const record = await store.findByHash(hashApiKey(result.secret));
    expect(record).toMatchObject({
      id: result.summary.id,
      tenantId: tenantA,
      name: "storefront",
      scopes: ["orders:read"],
      ipAllowlist: null,
    });
    // The SECURITY DEFINER lookup stamps last_used_at.
    expect(record?.lastUsedAt).not.toBeNull();

    const principal = await service.authenticate(result.secret, null);
    expect(principal).toMatchObject({ tenantId: tenantA, name: "storefront" });
  });

  it("resolves the same tenant's key through the app role without tenant scope", async () => {
    expect(created).toBeDefined();
    const rows = await asAppTenant(null, () =>
      client.query<{ tenant_id: string }>(
        "select tenant_id from find_api_key_by_hash($1)",
        [hashApiKey(created!.secret)],
      ),
    );

    // The SECURITY DEFINER function bypasses RLS for the global auth lookup
    // even under ops_hub_app, where a plain select would fail closed.
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.tenant_id).toBe(tenantA);
  });

  it("fails closed on direct row access without tenant scope", async () => {
    expect(created).toBeDefined();
    const scoped = await asAppTenant(tenantA, () =>
      client.query<{ count: number }>(
        "select count(*)::int as count from api_keys",
      ),
    );
    const unscoped = await asAppTenant(null, () =>
      client.query<{ count: number }>(
        "select count(*)::int as count from api_keys",
      ),
    );

    expect(scoped.rows[0]?.count).toBe(1);
    expect(unscoped.rows[0]?.count).toBe(0);
  });

  it("cannot read another tenant's keys under the app role", async () => {
    const count = await asAppTenant(tenantA, () =>
      client.query<{ count: number }>(
        "select count(*)::int as count from api_keys where tenant_id = $1",
        [tenantB],
      ),
    );

    expect(count.rows[0]?.count).toBe(0);
  });

  it("returns 401 for a revoked key on every path", async () => {
    expect(created).toBeDefined();

    const revoked = await service.revoke(tenantA, created!.id);
    expect(revoked).toBe(true);

    await expect(
      service.authenticate(created!.secret, null),
    ).rejects.toThrow(InvalidApiKeyError);
    await expect(
      store.findByHash(hashApiKey(created!.secret)),
    ).resolves.toBeNull();
  });

  it("rejects re-revocation with 404 semantics", async () => {
    expect(created).toBeDefined();
    await expect(service.revoke(tenantA, created!.id)).resolves.toBe(false);
    await expect(
      service.revoke(tenantB, created!.id),
    ).resolves.toBe(false);
  });
});
