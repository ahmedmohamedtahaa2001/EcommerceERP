ALTER TABLE "products" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_hazardous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "price_minor" integer;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "currency" text DEFAULT 'EGP' NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "timezone" text DEFAULT 'Africa/Cairo' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "default_currency" text DEFAULT 'EGP' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "country_code" text DEFAULT 'EG' NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "capacity" integer;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_fee_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "variants_tenant_barcode_key" ON "variants" USING btree ("tenant_id","barcode") WHERE "variants"."barcode" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_email_key" ON "customers" USING btree ("tenant_id",lower("email")) WHERE "customers"."email" is not null;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_weight_nonnegative" CHECK ("variants"."weight_grams" is null or "variants"."weight_grams" >= 0);--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_price_nonnegative" CHECK ("variants"."price_minor" is null or "variants"."price_minor" >= 0);--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_capacity_nonnegative" CHECK ("locations"."capacity" is null or "locations"."capacity" >= 0);--> statement-breakpoint
UPDATE "orders" o SET "subtotal_minor" = s.sum, "total_minor" = s.sum FROM (SELECT order_id, SUM(quantity * unit_price_minor)::int AS sum FROM "order_lines" GROUP BY order_id) s WHERE s.order_id = o.id;
