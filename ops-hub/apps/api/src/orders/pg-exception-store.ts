import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type { ExceptionStore } from "./types";

export class PgExceptionStore implements ExceptionStore {
  constructor(private readonly pool: Pool) {}

  async create(
    tenantId: string,
    orderId: string,
    reasonCode: string,
  ): Promise<{ id: string; reasonCode: string }> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `insert into exceptions (tenant_id, order_id, reason_code)
         values ($1, $2, $3)
         returning id`,
        [tenantId, orderId, reasonCode],
      );
      return { id: result.rows[0]!.id, reasonCode };
    });
  }
}
