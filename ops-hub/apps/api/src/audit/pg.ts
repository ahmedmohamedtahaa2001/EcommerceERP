import { keysetClause } from "../platform/service";
import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type {
  AuditActorType,
  AuditEntryInput,
  AuditEntryRecord,
  AuditQuery,
  AuditReader,
  AuditWriter,
} from "./types";

interface AuditRow {
  id: number;
  tenant_id: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  object_type: string;
  object_id: string | null;
  before: unknown;
  after: unknown;
  created_at: Date;
}

function jsonb(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function toRecord(row: AuditRow): AuditEntryRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorType: row.actor_type as AuditActorType,
    actorId: row.actor_id,
    action: row.action,
    objectType: row.object_type,
    objectId: row.object_id,
    before: row.before,
    after: row.after,
    createdAt: row.created_at,
  };
}

export class PgAuditWriter implements AuditWriter {
  constructor(private readonly pool: Pool) {}

  async record(entry: AuditEntryInput): Promise<void> {
    await withTenant(this.pool, entry.tenantId, (client) =>
      client.query(
        `insert into audit_log
           (tenant_id, actor_type, actor_id, action, object_type, object_id, before, after)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
        [
          entry.tenantId,
          entry.actorType,
          entry.actorId,
          entry.action,
          entry.objectType,
          entry.objectId,
          jsonb(entry.before),
          jsonb(entry.after),
        ],
      ),
    );
  }
}

export class PgAuditReader implements AuditReader {
  constructor(private readonly pool: Pool) {}

  async list(tenantId: string, query: AuditQuery): Promise<AuditEntryRecord[]> {
    const filters = ["tenant_id = $1"];
    const params: unknown[] = [tenantId];

    if (query.objectType !== undefined) {
      params.push(query.objectType);
      filters.push(`object_type = $${params.length}`);
    }
    if (query.objectId !== undefined) {
      params.push(query.objectId);
      filters.push(`object_id = $${params.length}`);
    }
    const limitClause = keysetClause(
      { limit: query.limit, cursor: query.cursor ?? null },
      filters,
      params,
      "created_at",
      "bigint",
    );

    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<AuditRow>(
        `select id, tenant_id, actor_type, actor_id, action,
                object_type, object_id, before, after, created_at
           from audit_log
          where ${filters.join(" and ")}
          order by created_at desc, id desc${limitClause}`,
        params,
      );
      return result.rows.map(toRecord);
    });
  }
}
