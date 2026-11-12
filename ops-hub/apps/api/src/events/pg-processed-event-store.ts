import { withTenant } from "@ops-hub/db";
import type { ProcessedEventStore } from "@ops-hub/events/idempotent-consumer";
import type { Pool } from "pg";

export class PgProcessedEventStore implements ProcessedEventStore {
  constructor(private readonly pool: Pool) {}

  async tryMarkProcessed(
    tenantId: string,
    consumer: string,
    eventId: string,
  ): Promise<boolean> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `insert into processed_events (tenant_id, consumer, event_id)
         values ($1, $2, $3)
         on conflict (consumer, event_id) do nothing`,
        [tenantId, consumer, eventId],
      );
      return result.rowCount === 1;
    });
  }

  async release(
    tenantId: string,
    consumer: string,
    eventId: string,
  ): Promise<void> {
    await withTenant(this.pool, tenantId, (client) =>
      client.query(
        `delete from processed_events where tenant_id = $1 and consumer = $2 and event_id = $3`,
        [tenantId, consumer, eventId],
      ),
    );
  }
}
