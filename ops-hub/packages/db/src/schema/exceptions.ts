import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants, users } from "./core";
import { orders } from "./orders";

/**
 * The Exceptions module (P1-S3-T06). Started as a minimal stub in
 * P1-S3-T04 (order validation failures needed somewhere to record a
 * reason); this is that same table extended, not replaced — the pattern
 * the roadmap itself already uses for P2-S6-T01's PO stub / P3-S9-T06.
 */
export const exceptions = pgTable(
  "exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    reasonCode: text("reason_code").notNull(),
    status: text("status").notNull().default("open"),
    /** Reason-specific extra context, e.g. `{ suspectedDuplicateOfOrderId }`
     * for DUPLICATE_SUSPECTED. */
    metadata: jsonb("metadata"),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Required at creation — an exception with no deadline can't go overdue. */
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    resolution: text("resolution"),
    /** Set once the SLA sweep has emitted `exception.overdue` for this row,
     * so it's only emitted once even if the sweep runs again before someone
     * resolves it. */
    overdueNotifiedAt: timestamp("overdue_notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("exceptions_tenant_order_idx").on(table.tenantId, table.orderId),
    index("exceptions_tenant_status_idx").on(table.tenantId, table.status),
    index("exceptions_tenant_due_idx").on(
      table.tenantId,
      table.status,
      table.dueAt,
    ),
  ],
);
