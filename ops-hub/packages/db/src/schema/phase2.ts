import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants, users } from "./core";
import { locations, bins } from "./inventory";
import { variants } from "./catalog";

/**
 * Phase 2 — receiving, putaway and cycle counts (Sprint 6).
 *
 * A receipt lands in `quarantined`; releasing it to `on_hand` requires a
 * SKU scan and a bin scan. Cycle counts are classified A/B/C and produce a
 * `COUNT_VARIANCE` adjustment only after approval.
 */

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** The purchase order this receipt answers, when there is one. */
    poId: uuid("po_id"),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("received"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set when every line has been released to a bin. */
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("receipts_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const receiptLines = pgTable(
  "receipt_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => receipts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    expectedQty: integer("expected_qty"),
    receivedQty: integer("received_qty").notNull().default(0),
    damagedQty: integer("damaged_qty").notNull().default(0),
    /** SKU the supplier actually sent when it differs from the ordered SKU. */
    substitutionSku: text("substitution_sku"),
    /** The bin the released units went to. */
    releasedBinId: uuid("released_bin_id"),
    releasedQty: integer("released_qty").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("receipt_lines_tenant_receipt_idx").on(
      table.tenantId,
      table.receiptId,
    ),
  ],
);

export const cycleCounts = pgTable(
  "cycle_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    /** ABC classification: `A` (weekly), `B` (monthly), `C` (quarterly). */
    classification: text("classification").notNull().default("C"),
    status: text("status").notNull().default("open"),
    expectedQty: integer("expected_qty").notNull().default(0),
    countedQty: integer("counted_qty"),
    /** Set when the variance adjustment has been applied. */
    adjustmentId: uuid("adjustment_id"),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    countedAt: timestamp("counted_at", { withTimezone: true }),
  },
  (table) => [
    index("cycle_counts_tenant_status_idx").on(table.tenantId, table.status),
    index("cycle_counts_tenant_location_idx").on(
      table.tenantId,
      table.locationId,
    ),
  ],
);

export const tenantSettings = pgTable(
  "tenant_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** e.g. `risk_thresholds`, `duplicate_window_hours`. */
    key: text("key").notNull(),
    /** JSON payload. */
    value: jsonb("value").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tenant_settings_tenant_key_key").on(table.tenantId, table.key),
  ],
);

export const binStock = pgTable(
  "bin_stock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    binId: uuid("bin_id")
      .notNull()
      .references(() => bins.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bin_stock_tenant_bin_idx").on(table.tenantId, table.binId),
    uniqueIndex("bin_stock_tenant_bin_variant_key").on(
      table.tenantId,
      table.binId,
      table.variantId,
    ),
  ],
);

export const codTasks = pgTable(
  "cod_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull(),
    status: text("status").notNull().default("pending"),
    /** `whatsapp` | `sms` | `call`. */
    channel: text("channel").notNull().default("whatsapp"),
    attempts: integer("attempts").notNull().default(0),
    /** `confirmed` | `changed` | `cancelled` | `no_answer`. */
    outcome: text("outcome"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("cod_tasks_tenant_status_idx").on(table.tenantId, table.status),
    index("cod_tasks_tenant_order_idx").on(table.tenantId, table.orderId),
  ],
);

export const codAttempts = pgTable(
  "cod_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => codTasks.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    outcome: text("outcome").notNull(),
    response: text("response"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cod_attempts_tenant_task_idx").on(table.tenantId, table.taskId),
  ],
);

export const riskScores = pgTable(
  "risk_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull(),
    /** `low` | `medium` | `high`. */
    tier: text("tier").notNull(),
    /** Human-readable reasons, e.g. `["2 prior refusals on this phone"]`. */
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
    /** The raw point total, so thresholds can live in tenant settings. */
    points: integer("points").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("risk_scores_tenant_order_idx").on(table.tenantId, table.orderId),
  ],
);

export const returns = pgTable(
  "returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull(),
    status: text("status").notNull().default("requested"),
    reasonCode: text("reason_code").notNull(),
    /** `restock` | `refurbish` | `outlet` | `liquidate` | `discard`. */
    disposition: text("disposition"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("returns_tenant_status_idx").on(table.tenantId, table.status),
    index("returns_tenant_order_idx").on(table.tenantId, table.orderId),
  ],
);

export const returnLines = pgTable(
  "return_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    returnId: uuid("return_id")
      .notNull()
      .references(() => returns.id, { onDelete: "cascade" }),
    orderLineId: uuid("order_line_id").notNull(),
    quantity: integer("quantity").notNull(),
    amountMinor: integer("amount_minor").notNull().default(0),
    currency: text("currency").notNull().default("EGP"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("return_lines_tenant_return_idx").on(table.tenantId, table.returnId),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull(),
    returnId: uuid("return_id").references(() => returns.id, {
      onDelete: "set null",
    }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("EGP"),
    status: text("status").notNull().default("pending_approval"),
    requestedBy: uuid("requested_by").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (table) => [
    index("refunds_tenant_status_idx").on(table.tenantId, table.status),
    index("refunds_tenant_order_idx").on(table.tenantId, table.orderId),
  ],
);

export const settlementFiles = pgTable(
  "settlement_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** SHA-256 of the uploaded file; importing the same file twice is a
     * no-op. */
    fileHash: text("file_hash").notNull(),
    carrier: text("carrier").notNull(),
    lineCount: integer("line_count").notNull().default(0),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("settlement_files_tenant_idx").on(table.tenantId, table.tenantId),
  ],
);

export const settlementLines = pgTable(
  "settlement_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => settlementFiles.id, { onDelete: "cascade" }),
    trackingNumber: text("tracking_number").notNull(),
    orderId: uuid("order_id"),
    amountMinor: integer("amount_minor").notNull().default(0),
    currency: text("currency").notNull().default("EGP"),
    /** `delivery_fee` | `return_fee` | `cod_commission` | `storage` | `other`. */
    deductionType: text("deduction_type"),
    deductionMinor: integer("deduction_minor").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("settlement_lines_tenant_file_idx").on(table.tenantId, table.fileId),
  ],
);

export const connectors = pgTable(
  "connectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** `shopify` | `bosta` | `posta` | `jt` | `whatsapp` | `email`. */
    type: text("type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastError: text("last_error"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    errorCount: integer("error_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("connectors_tenant_idx").on(table.tenantId, table.name)],
);

export const dlqEntries = pgTable(
  "dlq_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Where the message came from, e.g. `outbox` or `webhook`. */
    source: text("source").notNull(),
    payload: jsonb("payload").notNull(),
    error: text("error").notNull(),
    attempts: integer("attempts").notNull().default(0),
    status: text("status").notNull().default("dead"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    replayedAt: timestamp("replayed_at", { withTimezone: true }),
  },
  (table) => [
    index("dlq_entries_tenant_status_idx").on(table.tenantId, table.status),
  ],
);
