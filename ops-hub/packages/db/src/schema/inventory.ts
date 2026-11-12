import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  check,
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

/** A storage location: the tenant's own warehouse, a 3PL, a shop, transit. */
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    code: text("code"),
    governorateCode: text("governorate_code"),
    address: text("address"),
    /** Storage capacity in units. Null means unlimited / not tracked. */
    capacity: integer("capacity"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "locations_capacity_nonnegative",
      sql`${table.capacity} is null or ${table.capacity} >= 0`,
    ),
    uniqueIndex("locations_tenant_code_key").on(table.tenantId, table.code),
    index("locations_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

/** A shelf/rack/bin within a location, used for guided putaway. */
export const bins = pgTable(
  "bins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    zone: text("zone"),
    code: text("code").notNull(),
    capacity: integer("capacity"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("bins_location_code_key").on(table.locationId, table.code),
    index("bins_tenant_location_idx").on(table.tenantId, table.locationId),
  ],
);

/** Derived, per-bucket stock level for a variant at a location. */
export const stockBalances = pgTable(
  "stock_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    bucket: text("bucket").notNull(),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stock_balances_variant_location_bucket_key").on(
      table.variantId,
      table.locationId,
      table.bucket,
    ),
    index("stock_balances_tenant_variant_idx").on(
      table.tenantId,
      table.variantId,
    ),
  ],
);

/**
 * Append-only ledger: every stock change is one row. `stock_balances` is a
 * derived cache; it must never be written directly outside this ledger.
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    bucket: text("bucket").notNull().default("on_hand"),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    reference: text("reference"),
    actorType: text("actor_type"),
    actorId: uuid("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_movements_tenant_variant_idx").on(
      table.tenantId,
      table.variantId,
    ),
    index("stock_movements_tenant_location_idx").on(
      table.tenantId,
      table.locationId,
    ),
  ],
);

/** A short-lived hold against available stock while an order is allocated. */
export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    status: text("status").notNull().default("active"),
    /** Set when the reservation holds stock for an order, so cancelling the order can release it. */
    orderId: uuid("order_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (table) => [
    index("stock_reservations_tenant_variant_idx").on(
      table.tenantId,
      table.variantId,
      table.locationId,
    ),
    index("stock_reservations_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.expiresAt,
    ),
  ],
);

export const locationsRelations = relations(locations, ({ many }) => ({
  bins: many(bins),
}));

export const binsRelations = relations(bins, ({ one }) => ({
  location: one(locations, {
    fields: [bins.locationId],
    references: [locations.id],
  }),
}));
