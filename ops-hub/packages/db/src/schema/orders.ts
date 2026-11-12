import { sql } from "drizzle-orm";
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
import { variants } from "./catalog";

/** A customer's identity within a tenant is their normalized E.164 phone. */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    fullName: text("full_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    email: text("email"),
  },
  (table) => [
    uniqueIndex("customers_tenant_phone_key").on(table.tenantId, table.phone),
    uniqueIndex("customers_tenant_email_key")
      .on(table.tenantId, sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
  ],
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city"),
    /** The canonical code from `resolveGovernorate`, or null if it didn't resolve. */
    governorateCode: text("governorate_code"),
    /** What the customer actually typed, kept even when it resolved. */
    rawGovernorate: text("raw_governorate"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("addresses_tenant_customer_idx").on(table.tenantId, table.customerId),
  ],
);

/**
 * One row per tenant, incremented in the same transaction as the order it
 * numbers. If that transaction rolls back, the increment rolls back with
 * it — the sequence can have no gaps, by construction, not by convention.
 */
export const orderNumberCounters = pgTable("order_number_counters", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  nextNumber: integer("next_number").notNull().default(1),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Formatted as `OP-10001`; see `order_number_counters`. */
    orderNumber: text("order_number").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    addressId: uuid("address_id").references(() => addresses.id, {
      onDelete: "restrict",
    }),
    status: text("status").notNull().default("pending"),
    currency: text("currency").notNull().default("EGP"),
    /** Order-level money in minor units. `totalMinor` is what the customer
     * owes: subtotal - discount + shipping + tax. */
    subtotalMinor: integer("subtotal_minor").notNull().default(0),
    discountMinor: integer("discount_minor").notNull().default(0),
    shippingFeeMinor: integer("shipping_fee_minor").notNull().default(0),
    taxMinor: integer("tax_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),
    channel: text("channel").notNull().default("manual"),
    externalOrderId: text("external_order_id"),
    idempotencyKey: text("idempotency_key"),
    /** SHA-256 of the canonicalized request body, so a replayed
     * Idempotency-Key with a different body can be told apart from a true
     * retry. */
    idempotencyBodyHash: text("idempotency_body_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_tenant_order_number_key").on(
      table.tenantId,
      table.orderNumber,
    ),
    uniqueIndex("orders_tenant_idempotency_key_key").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("orders_tenant_customer_idx").on(table.tenantId, table.customerId),
    index("orders_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const orderLines = pgTable(
  "order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    /** Snapshot at order time — the variant's SKU may not change, but this
     * keeps the line self-describing even if it did. */
    sku: text("sku").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    currency: text("currency").notNull(),
  },
  (table) => [
    index("order_lines_tenant_order_idx").on(table.tenantId, table.orderId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payments_tenant_order_idx").on(table.tenantId, table.orderId),
  ],
);
