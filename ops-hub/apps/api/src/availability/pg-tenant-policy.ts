import type { Pool } from "pg";

import type { TenantStockPolicyReader } from "./types";

/**
 * `tenants` has no tenant_id of its own to scope by — a caller only ever
 * knows the tenant id from their own authenticated principal, so this reads
 * directly without `withTenant`.
 */
export class PgTenantPolicyReader implements TenantStockPolicyReader {
  constructor(private readonly pool: Pool) {}

  async allowsNegativeStock(tenantId: string): Promise<boolean> {
    const result = await this.pool.query<{ allow_negative_stock: boolean }>(
      `select allow_negative_stock from tenants where id = $1`,
      [tenantId],
    );
    return result.rows[0]?.allow_negative_stock ?? false;
  }
}
