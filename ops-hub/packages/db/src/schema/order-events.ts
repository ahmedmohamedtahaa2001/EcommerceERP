import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./core";
import { orders } from "./orders";

/**
 * Append-only timeline: every status transition and every note (internal or
 * customer-visible) on an order is one row here, in creation order.
 */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** `"status_changed"` or `"note"`. */
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    note: text("note"),
    /** Internal notes are staff-only; customer-visible ones could be shown
     * on a tracking page. Status-changed events are never customer-visible
     * on their own — a customer-facing summary is a later task's job. */
    customerVisible: boolean("customer_visible").notNull().default(false),
    actorType: text("actor_type"),
    actorId: uuid("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("order_events_tenant_order_idx").on(
      table.tenantId,
      table.orderId,
      table.createdAt,
    ),
  ],
);
