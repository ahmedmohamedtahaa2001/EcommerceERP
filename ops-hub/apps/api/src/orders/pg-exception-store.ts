import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type { ExceptionRecord, ExceptionStore } from "./types";

interface ExceptionRow {
  id: string;
  tenant_id: string;
  order_id: string;
  reason_code: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

function toRecord(row: ExceptionRow): ExceptionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    reasonCode: row.reason_code,
    status: row.status,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export class PgExceptionStore implements ExceptionStore {
  constructor(private readonly pool: Pool) {}

  async create(
    tenantId: string,
    orderId: string,
    reasonCode: string,
    metadata?: Record<string, unknown>,
  ): Promise<ExceptionRecord> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ExceptionRow>(
        `insert into exceptions (tenant_id, order_id, reason_code, metadata)
         values ($1, $2, $3, $4::jsonb)
         returning *`,
        [
          tenantId,
          orderId,
          reasonCode,
          metadata ? JSON.stringify(metadata) : null,
        ],
      );
      return toRecord(result.rows[0]!);
    });
  }

  async getById(tenantId: string, id: string): Promise<ExceptionRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ExceptionRow>(
        `select * from exceptions where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toRecord(row) : null;
    });
  }

  async resolve(tenantId: string, id: string): Promise<boolean> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `update exceptions set status = 'resolved'
          where tenant_id = $1 and id = $2 and status = 'open'`,
        [tenantId, id],
      );
      return result.rowCount === 1;
    });
  }
}
