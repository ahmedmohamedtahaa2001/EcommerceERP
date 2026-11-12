import { withTenant } from "@ops-hub/db";
import { appendOutboxEvent } from "@ops-hub/events";
import type { Pool } from "pg";

import type { ExceptionRecord, ExceptionStore } from "./types";

interface ExceptionRow {
  id: string;
  tenant_id: string;
  order_id: string;
  reason_code: string;
  status: string;
  metadata: Record<string, unknown> | null;
  owner_id: string | null;
  due_at: Date;
  resolution: string | null;
  overdue_notified_at: Date | null;
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
    ownerId: row.owner_id,
    dueAt: row.due_at,
    resolution: row.resolution,
    overdueNotifiedAt: row.overdue_notified_at,
    createdAt: row.created_at,
  };
}

export class PgExceptionStore implements ExceptionStore {
  constructor(private readonly pool: Pool) {}

  async create(
    tenantId: string,
    orderId: string,
    reasonCode: string,
    dueAt: Date,
    metadata?: Record<string, unknown>,
  ): Promise<ExceptionRecord> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ExceptionRow>(
        `insert into exceptions (tenant_id, order_id, reason_code, due_at, metadata)
         values ($1, $2, $3, $4, $5::jsonb)
         returning *`,
        [
          tenantId,
          orderId,
          reasonCode,
          dueAt,
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

  async list(
    tenantId: string,
    filter: {
      status?: string;
      orderId?: string;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<ExceptionRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.status !== undefined) {
        params.push(filter.status);
        conditions.push(`status = $${params.length}`);
      }
      if (filter.orderId !== undefined) {
        params.push(filter.orderId);
        conditions.push(`order_id = $${params.length}`);
      }
      if (filter.cursor) {
        params.push(filter.cursor.createdAt, filter.cursor.id);
        conditions.push(
          "(created_at, id) < ($" +
            params.length +
            "::timestamptz, $" +
            (params.length + 1) +
            "::uuid)",
        );
      }
      const limitClause =
        filter.limit === undefined
          ? ""
          : ` limit $${(params.push(filter.limit), params.length)}`;
      const result = await client.query<ExceptionRow>(
        `select * from exceptions where ${conditions.join(" and ")}
          order by created_at desc, id desc${limitClause}`,
        params,
      );
      return result.rows.map(toRecord);
    });
  }

  async assign(
    tenantId: string,
    id: string,
    ownerId: string,
  ): Promise<ExceptionRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ExceptionRow>(
        `update exceptions set owner_id = $3
          where tenant_id = $1 and id = $2
          returning *`,
        [tenantId, id, ownerId],
      );
      const row = result.rows[0];
      return row ? toRecord(row) : null;
    });
  }

  async resolve(
    tenantId: string,
    id: string,
    resolution: string,
  ): Promise<boolean> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `update exceptions set status = 'resolved', resolution = $3
          where tenant_id = $1 and id = $2 and status = 'open'`,
        [tenantId, id, resolution],
      );
      return result.rowCount === 1;
    });
  }

  /** Marks overdue exceptions notified and appends their `exception.overdue`
   * outbox event in the SAME transaction: a crash between the two can never
   * leave an exception marked-notified with no event actually queued. */
  async claimOverdue(tenantId: string, asOf: Date): Promise<ExceptionRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ExceptionRow>(
        `update exceptions
            set overdue_notified_at = $2
          where tenant_id = $1
            and status = 'open'
            and due_at <= $2
            and overdue_notified_at is null
          returning *`,
        [tenantId, asOf],
      );
      const records = result.rows.map(toRecord);
      for (const record of records) {
        await appendOutboxEvent(client, {
          tenantId,
          eventType: "exception.overdue",
          payload: record,
        });
      }
      return records;
    });
  }
}
