import { relations } from "drizzle-orm";
import {
  boolean,
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
import { sql } from "drizzle-orm";

import { tenants } from "./core";

/**
 * A product is the sellable unit as seen by customers. `kind` distinguishes
 * a simple product (one implicit variant) from a bundle (composed of other
 * variants via `bundleComponents`). Stock is always tracked at the variant
 * level.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("simple"),
    category: text("category"),
    brand: text("brand"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    isHazardous: boolean("is_hazardous").notNull().default(false),
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

/**
 * A variant is the stock-keeping unit. SKU is unique per tenant and immutable
 * once created (enforced in the service layer). Variant-level `attributes`
 * (size, color, ...) and `images` let a simple product carry exactly one
 * variant with the product's own defaults, or many for real variation.
 */
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
    barcode: text("barcode"),
    weightGrams: integer("weight_grams"),
    dimensions: jsonb("dimensions")
      .$type<{ lengthCm?: number; widthCm?: number; heightCm?: number }>()
      .notNull()
      .default({}),
    /** Catalog list price in minor units. Null means not priced yet. */
    priceMinor: integer("price_minor"),
    currency: text("currency").notNull().default("EGP"),
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
    uniqueIndex("variants_tenant_barcode_key")
      .on(table.tenantId, table.barcode)
      .where(sql`${table.barcode} is not null`),
    index("variants_tenant_product_idx").on(table.tenantId, table.productId),
    check(
      "variants_weight_nonnegative",
      sql`${table.weightGrams} is null or ${table.weightGrams} >= 0`,
    ),
    check(
      "variants_price_nonnegative",
      sql`${table.priceMinor} is null or ${table.priceMinor} >= 0`,
    ),
  ],
);

/**
 * Links a bundle product (`products.kind = 'bundle'`) to the component
 * variants it is made of and how many of each.
 */
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
    index("bundle_components_tenant_bundle_idx").on(
      table.tenantId,
      table.bundleProductId,
    ),
    uniqueIndex("bundle_components_bundle_variant_key").on(
      table.bundleProductId,
      table.componentVariantId,
    ),
    check("bundle_components_quantity_positive", sql`${table.quantity} > 0`),
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

export const bundleComponentsRelations = relations(
  bundleComponents,
  ({ one }) => ({
    bundleProduct: one(products, {
      fields: [bundleComponents.bundleProductId],
      references: [products.id],
    }),
    componentVariant: one(variants, {
      fields: [bundleComponents.componentVariantId],
      references: [variants.id],
    }),
  }),
);
