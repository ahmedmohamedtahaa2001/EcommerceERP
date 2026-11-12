import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./core";

/**
 * The transactional outbox: every domain change that must emit an event
 * inserts a row here in the SAME transaction as the change itself. A
 * separate dispatcher later reads unpublished rows and sends them to the
 * queue; it only marks a row published after a successful send, so a crash
 * mid-batch leaves it to be retried, never silently dropped.
 */
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
  },
  (table) => [
    index("outbox_events_unpublished_idx").on(
      table.publishedAt,
      table.createdAt,
    ),
    index("outbox_events_tenant_idx").on(table.tenantId, table.createdAt),
  ],
);

/**
 * Consumer-side dedup: before a consumer acts on a delivered event, it
 * inserts (consumer, event_id) here; a unique-violation means this exact
 * consumer already processed this event, so at-least-once delivery from the
 * queue still results in the handler running at most once.
 */
export const processedEvents = pgTable(
  "processed_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    consumer: text("consumer").notNull(),
    eventId: uuid("event_id").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("processed_events_consumer_event_key").on(
      table.consumer,
      table.eventId,
    ),
  ],
);
