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
import { variants } from "./catalog";
import { orders } from "./orders";

/**
 * Phase 3 — buying, supplier accountability, unified inbox and CRM
 * (Sprints 9–12).
 */

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    /** Standard lead time in days. */
    leadTimeDays: integer("lead_time_days").notNull().default(0),
    /** Rolling average of actual lead times, in days. */
    actualLeadTimeDays: integer("actual_lead_time_days").notNull().default(0),
    /** Minimum order quantity per line. */
    moq: integer("moq").notNull().default(1),
    /** Payment terms in days (e.g. 30 = net 30). */
    paymentTermsDays: integer("payment_terms_days").notNull().default(0),
    /** Documents the supplier still owes us. */
    documentsChecklist: jsonb("documents_checklist")
      .$type<Record<string, boolean>>()
      .notNull()
      .default({}),
    isBackup: boolean("is_backup").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("suppliers_tenant_name_key").on(table.tenantId, table.name),
  ],
);

export const supplierSkus = pgTable(
  "supplier_skus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    supplierSku: text("supplier_sku").notNull(),
    /** Units per supplier carton; purchase orders round up to this. */
    packSize: integer("pack_size").notNull().default(1),
    isBackup: boolean("is_backup").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("supplier_skus_tenant_variant_idx").on(
      table.tenantId,
      table.variantId,
    ),
  ],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull().default("EGP"),
    totalMinor: integer("total_minor").notNull().default(0),
    expectedAt: timestamp("expected_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("purchase_orders_tenant_number_key").on(
      table.tenantId,
      table.number,
    ),
    index("purchase_orders_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const poLines = pgTable(
  "po_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    poId: uuid("po_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitCostMinor: integer("unit_cost_minor").notNull().default(0),
    receivedQty: integer("received_qty").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("po_lines_tenant_po_idx").on(table.tenantId, table.poId)],
);

export const poEvents = pgTable(
  "po_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    poId: uuid("po_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("po_events_tenant_po_idx").on(table.tenantId, table.poId)],
);

export const supplierScorecards = pgTable(
  "supplier_scorecards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    ackTimeHours: integer("ack_time_hours").notNull().default(0),
    /** On time in full, 0–100. */
    otifRate: integer("otif_rate").notNull().default(0),
    fillRate: integer("fill_rate").notNull().default(0),
    damageRate: integer("damage_rate").notNull().default(0),
    costVarianceMinor: integer("cost_variance_minor").notNull().default(0),
    claimCount: integer("claim_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("supplier_scorecards_tenant_supplier_idx").on(
      table.tenantId,
      table.supplierId,
    ),
  ],
);

export const landedCosts = pgTable(
  "landed_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    poId: uuid("po_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    poLineId: uuid("po_line_id")
      .notNull()
      .references(() => poLines.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    /** `value` or `weight`. */
    allocationBasis: text("allocation_basis").notNull().default("value"),
    allocatedCostMinor: integer("allocated_cost_minor").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("landed_costs_tenant_po_idx").on(table.tenantId, table.poId),
  ],
);

export const carrierScorecards = pgTable(
  "carrier_scorecards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    carrier: text("carrier").notNull(),
    governorateCode: text("governorate_code").notNull(),
    service: text("service").notNull().default("standard"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    onTimeRate: integer("on_time_rate").notNull().default(0),
    firstAttemptRate: integer("first_attempt_rate").notNull().default(0),
    exceptionRate: integer("exception_rate").notNull().default(0),
    costPerShipmentMinor: integer("cost_per_shipment_minor")
      .notNull()
      .default(0),
    claims: integer("claims").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("carrier_scorecards_tenant_carrier_idx").on(
      table.tenantId,
      table.carrier,
    ),
  ],
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    carrier: text("carrier").notNull(),
    shipmentId: uuid("shipment_id"),
    /** `lost` | `damaged` | `false_delivered`. */
    type: text("type").notNull(),
    status: text("status").notNull().default("open"),
    description: text("description").notNull(),
    /** Evidence attachment references; a claim cannot close without them
     * unless it is explicitly waived. */
    evidence: jsonb("evidence").$type<string[]>().notNull().default([]),
    waived: boolean("waived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("claims_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id"),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    shipmentId: uuid("shipment_id"),
    type: text("type").notNull().default("general"),
    /** `critical` | `high` | `normal` | `low`. */
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull().default("open"),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }).notNull(),
    escalated: boolean("escalated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("tickets_tenant_status_idx").on(table.tenantId, table.status),
    index("tickets_tenant_priority_idx").on(table.tenantId, table.priority),
  ],
);

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("internal"),
    /** `inbound` or `outbound`. */
    direction: text("direction").notNull().default("inbound"),
    body: text("body").notNull(),
    /** Internal notes are never sent to the customer. */
    internal: boolean("internal").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ticket_messages_tenant_ticket_idx").on(
      table.tenantId,
      table.ticketId,
    ),
  ],
);

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** `whatsapp` | `instagram` | `facebook` | `email`. */
    type: text("type").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    /** Maximum attachment size in bytes. */
    maxAttachmentBytes: integer("max_attachment_bytes")
      .notNull()
      .default(10_485_760),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("channels_tenant_type_name_key").on(
      table.tenantId,
      table.type,
      table.name,
    ),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversations_tenant_customer_idx").on(
      table.tenantId,
      table.customerId,
    ),
  ],
);

export const macros = pgTable(
  "macros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    ar: text("ar").notNull(),
    en: text("en").notNull(),
    /** Variables the macro expects, e.g. `["orderNumber"]`. */
    variables: jsonb("variables").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("macros_tenant_key_key").on(table.tenantId, table.key),
  ],
);

export const customerProfiles = pgTable(
  "customer_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull(),
    /** Set when this profile was merged into another one. */
    mergedIntoId: uuid("merged_into_id"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("customer_profiles_tenant_customer_idx").on(
      table.tenantId,
      table.customerId,
    ),
  ],
);

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull(),
    /** `whatsapp` | `sms` | `email` | `instagram`. */
    channel: text("channel").notNull(),
    /** `marketing` | `transactional`. */
    purpose: text("purpose").notNull(),
    granted: boolean("granted").notNull().default(false),
    source: text("source").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("consents_tenant_customer_idx").on(table.tenantId, table.customerId),
  ],
);

export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    /** e.g. `{ type: "vip", minOrders: 3 }`. */
    definition: jsonb("definition").notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("segments_tenant_key_key").on(table.tenantId, table.key),
  ],
);

export const segmentMembers = pgTable(
  "segment_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id")
      .notNull()
      .references(() => segments.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("segment_members_tenant_segment_idx").on(
      table.tenantId,
      table.segmentId,
    ),
  ],
);

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    /** Domain event that fires the automation. */
    triggerEvent: text("trigger_event").notNull(),
    conditions: jsonb("conditions")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    actions: jsonb("actions")
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default([]),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("automations_tenant_key_key").on(table.tenantId, table.key),
  ],
);

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("ok"),
    result: jsonb("result").notNull().default({}),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("automation_runs_tenant_automation_idx").on(
      table.tenantId,
      table.automationId,
    ),
  ],
);

export const kpiSnapshots = pgTable(
  "kpi_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    metric: text("metric").notNull(),
    value: integer("value").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("kpi_snapshots_tenant_date_metric_key").on(
      table.tenantId,
      table.date,
      table.metric,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id"),
    templateKey: text("template_key").notNull(),
    channel: text("channel").notNull().default("email"),
    recipient: text("recipient").notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notifications_tenant_order_template_key").on(
      table.tenantId,
      table.orderId,
      table.templateKey,
    ),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** e.g. `OVERSOLD`, `SCAN_GAP`, `COD_UNMATCHED`. */
    kind: text("kind").notNull(),
    severity: text("severity").notNull().default("warning"),
    message: text("message").notNull(),
    /** Set once the alert has been delivered, so a breach window fires
     * only once. */
    triggeredAt: timestamp("triggered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  },
  (table) => [index("alerts_tenant_kind_idx").on(table.tenantId, table.kind)],
);
