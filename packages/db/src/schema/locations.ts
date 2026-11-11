import { relations } from "drizzle-orm";
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

export const LOCATION_TYPES = ["warehouse", "3pl", "shop", "transit"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("locations_tenant_created_idx").on(table.tenantId, table.createdAt),
    uniqueIndex("locations_tenant_code_key").on(table.tenantId, table.code),
  ],
);

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

export const locationsRelations = relations(locations, ({ many }) => ({
  bins: many(bins),
}));

export const binsRelations = relations(bins, ({ one }) => ({
  location: one(locations, {
    fields: [bins.locationId],
    references: [locations.id],
  }),
}));
