import { relations, sql } from "drizzle-orm";
import {
  check,
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
import { locations } from "./locations";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("simple"),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    descriptionAr: text("description_ar"),
    descriptionEn: text("description_en"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("products_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("products_tenant_kind_idx").on(table.tenantId, table.kind),
  ],
);

export const variants = pgTable(
  "variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    attributes: jsonb("attributes")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("variants_tenant_sku_key").on(table.tenantId, table.sku),
    index("variants_tenant_product_idx").on(table.tenantId, table.productId),
  ],
);

export const bundleComponents = pgTable(
  "bundle_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bundleProductId: uuid("bundle_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    componentVariantId: uuid("component_variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    uniqueIndex("bundle_components_bundle_variant_key").on(
      table.bundleProductId,
      table.componentVariantId,
    ),
    index("bundle_components_tenant_bundle_idx").on(
      table.tenantId,
      table.bundleProductId,
    ),
    check("bundle_components_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

/**
 * Skeleton of the stock ledger. The full ledger (buckets, locations,
 * balances, reason codes) lands in P0-S2-T05; this table exists now so the
 * catalog can enforce "SKU immutable once a movement exists" and foreign-key
 * the movement to its variant. Extended, never replaced, by T05.
 */
export const BUCKETS = ["on_hand", "reserved", "quarantined", "damaged", "in_transit"] as const;
export type Bucket = (typeof BUCKETS)[number];

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

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(variants),
}));

export const variantsRelations = relations(variants, ({ one }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
}));

export const bundleComponentsRelations = relations(bundleComponents, ({ one }) => ({
  bundle: one(products, {
    fields: [bundleComponents.bundleProductId],
    references: [products.id],
  }),
  component: one(variants, {
    fields: [bundleComponents.componentVariantId],
    references: [variants.id],
  }),
}));
