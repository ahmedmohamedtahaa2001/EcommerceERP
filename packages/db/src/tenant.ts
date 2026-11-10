import type { Pool, PoolClient } from "pg";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Runs `work` inside a transaction whose `app.tenant_id` setting is visible
 * only to that transaction. RLS policies read it through
 * `current_tenant_id()`; when it is unset, every tenant-scoped table returns
 * no rows.
 *
 * The pooled connection must already authenticate as the application role
 * (`ops_hub_app`); this helper only establishes the tenant scope.
 */
export async function withTenant<T>(
  pool: Pool,
  tenantId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error("withTenant requires a UUID tenant id");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
