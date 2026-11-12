import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./core";
import { orders } from "./orders";

/**
 * Minimal stub: just enough for P1-S3-T04 (order validation failures need
 * somewhere to record a reason). P1-S3-T06 is the real Exceptions module
 * (owner, due_at, resolution, list/assign/resolve endpoints, SLA timer) and
 * will extend this table rather than replace it — the same "stub now, full
 * module later" pattern already used for P2-S6-T01's PO stub / P3-S9-T06.
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("exceptions_tenant_order_idx").on(table.tenantId, table.orderId),
    index("exceptions_tenant_status_idx").on(table.tenantId, table.status),
  ],
);
