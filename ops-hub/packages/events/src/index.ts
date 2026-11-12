export interface NewOutboxEvent {
  tenantId: string;
  eventType: string;
  payload: unknown;
}

export interface OutboxEventRecord {
  id: string;
  tenantId: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
  publishedAt: Date | null;
  attempts: number;
}

/** The minimal query surface the outbox writer needs — a `pg` client or
 * pool, kept generic so this package stays free of a `pg` dependency. */
export interface Queryable {
  query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Appends one outbox row. Callers MUST pass the same client/transaction
 * they use for the domain change the event describes — that's what makes
 * the write transactional: if the domain change rolls back, so does this.
 */
export async function appendOutboxEvent(
  client: Queryable,
  event: NewOutboxEvent,
): Promise<void> {
  await client.query(
    `insert into outbox_events (tenant_id, event_type, payload)
     values ($1, $2, $3::jsonb)`,
    [event.tenantId, event.eventType, JSON.stringify(event.payload)],
  );
}
