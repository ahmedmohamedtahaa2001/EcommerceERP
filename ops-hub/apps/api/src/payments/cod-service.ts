import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export type CodStatus =
  "pending_collection" | "collected" | "failed" | "returned";

export class CodService {
  constructor(private readonly pool: Pool) {}

  async recordCollection(
    tenantId: string,
    paymentId: string,
    status: CodStatus,
    collectedAmountMinor?: number,
  ): Promise<void> {
    await withTenant(this.pool, tenantId, async (client) => {
      await client.query(
        `update payments set status=$3, updated_at=now() where tenant_id=$1 and id=$2`,
        [tenantId, paymentId, status],
      );
      if (collectedAmountMinor !== undefined) {
        await client.query(
          `update payments set amount_minor=$3 where tenant_id=$1 and id=$2`,
          [tenantId, paymentId, collectedAmountMinor],
        );
      }
    });
  }

  async getStatus(
    tenantId: string,
    paymentId: string,
  ): Promise<CodStatus | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query<{ status: string }>(
        `select status from payments where tenant_id=$1 and id=$2`,
        [tenantId, paymentId],
      );
      return (r.rows[0]?.status as CodStatus) ?? null;
    });
  }
}
