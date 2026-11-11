CREATE TABLE "bundle_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bundle_product_id" uuid NOT NULL,
	"component_variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "bundle_components_quantity_positive" CHECK ("bundle_components"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text DEFAULT 'simple' NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"description_ar" text,
	"description_en" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_type" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_bundle_product_id_products_id_fk" FOREIGN KEY ("bundle_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_component_variant_id_variants_id_fk" FOREIGN KEY ("component_variant_id") REFERENCES "public"."variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bundle_components_bundle_variant_key" ON "bundle_components" USING btree ("bundle_product_id","component_variant_id");--> statement-breakpoint
CREATE INDEX "bundle_components_tenant_bundle_idx" ON "bundle_components" USING btree ("tenant_id","bundle_product_id");--> statement-breakpoint
CREATE INDEX "products_tenant_created_idx" ON "products" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "products_tenant_kind_idx" ON "products" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_variant_idx" ON "stock_movements" USING btree ("tenant_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_tenant_sku_key" ON "variants" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "variants_tenant_product_idx" ON "variants" USING btree ("tenant_id","product_id");
--> statement-breakpoint
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.bundle_components ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY products_tenant_isolation ON public.products
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
CREATE POLICY variants_tenant_isolation ON public.variants
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
CREATE POLICY bundle_components_tenant_isolation ON public.bundle_components
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
CREATE POLICY stock_movements_tenant_isolation ON public.stock_movements
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON products, variants, bundle_components TO ops_hub_app;--> statement-breakpoint
GRANT SELECT, INSERT ON stock_movements TO ops_hub_app;--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON stock_movements FROM ops_hub_app;
