import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./core";
import { orders } from "./orders";

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull().default(1),
    carrier: text("carrier").notNull(),
    carrierShipmentId: text("carrier_shipment_id"),
    trackingNumber: text("tracking_number"),
    status: text("status").notNull().default("label_created"),
    serviceLevel: text("service_level"),
    labelUrl: text("label_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("shipments_tenant_order_sequence_key").on(
      table.tenantId,
      table.orderId,
      table.sequence,
    ),
    index("shipments_tenant_order_idx").on(table.tenantId, table.orderId),
    index("shipments_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const shipmentRequests = pgTable(
  "shipment_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "cascade",
    }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestBody: text("request_body"),
    responseBody: text("response_body"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shipment_requests_tenant_shipment_idx").on(
      table.tenantId,
      table.shipmentId,
    ),
  ],
);

export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    carrierStatus: text("carrier_status").notNull(),
    status: text("status").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    location: text("location"),
    description: text("description"),
    raw: text("raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shipment_events_tenant_shipment_idx").on(
      table.tenantId,
      table.shipmentId,
      table.occurredAt,
    ),
  ],
);
