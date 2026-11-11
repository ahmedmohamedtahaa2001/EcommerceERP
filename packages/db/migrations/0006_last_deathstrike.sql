CREATE TABLE "stock_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "bucket" text DEFAULT 'on_hand' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_variant_location_bucket_key" ON "stock_balances" USING btree ("variant_id","location_id","bucket");--> statement-breakpoint
CREATE INDEX "stock_balances_tenant_variant_idx" ON "stock_balances" USING btree ("tenant_id","variant_id");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_location_idx" ON "stock_movements" USING btree ("tenant_id","location_id");
--> statement-breakpoint
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY stock_balances_tenant_isolation ON public.stock_balances
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_balances TO ops_hub_app;--> statement-breakpoint
GRANT SELECT, INSERT ON stock_movements TO ops_hub_app;--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON stock_movements FROM ops_hub_app;
