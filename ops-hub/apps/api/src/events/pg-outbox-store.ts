import type { OutboxEventRecord } from "@ops-hub/events";
import type { OutboxStore } from "@ops-hub/events/dispatcher";
import type { Pool } from "pg";

interface OutboxRow {
  id: string;
  tenant_id: string;
  event_type: string;
  payload: unknown;
  created_at: Date;
  published_at: Date | null;
  attempts: number;
}

function toRecord(row: OutboxRow): OutboxEventRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    eventType: row.event_type,
    payload: row.payload,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    attempts: row.attempts,
  };
}

/**
 * Reads across ALL tenants (the dispatcher is a single cross-tenant
 * worker), so this runs as the table owner rather than through
 * `withTenant` — RLS would otherwise hide every tenant but one.
 */
export class PgOutboxStore implements OutboxStore {
  constructor(private readonly pool: Pool) {}

  async listUnpublished(limit: number): Promise<OutboxEventRecord[]> {
    const result = await this.pool.query<OutboxRow>(
      `select * from outbox_events where published_at is null
        order by created_at asc
        limit $1`,
      [limit],
    );
    return result.rows.map(toRecord);
  }

  async markPublished(id: string): Promise<void> {
    await this.pool.query(
      `update outbox_events set published_at = now() where id = $1`,
      [id],
    );
  }
}
