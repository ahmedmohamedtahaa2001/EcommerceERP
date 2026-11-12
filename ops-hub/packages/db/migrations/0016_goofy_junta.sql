CREATE TABLE "bin_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bin_stock" ADD CONSTRAINT "bin_stock_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bin_stock" ADD CONSTRAINT "bin_stock_bin_id_bins_id_fk" FOREIGN KEY ("bin_id") REFERENCES "public"."bins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bin_stock" ADD CONSTRAINT "bin_stock_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bin_stock_tenant_bin_idx" ON "bin_stock" USING btree ("tenant_id","bin_id");--> statement-breakpoint
CREATE INDEX "bin_stock_tenant_variant_idx" ON "bin_stock" USING btree ("tenant_id","variant_id","bin_id");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON bin_stock TO ops_hub_app;--> statement-breakpoint
ALTER TABLE public.bin_stock ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY bin_stock_tenant_isolation ON public.bin_stock
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
