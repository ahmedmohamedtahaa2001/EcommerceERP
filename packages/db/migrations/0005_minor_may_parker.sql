CREATE TABLE "bins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"zone" text,
	"code" text NOT NULL,
	"capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"governorate_code" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "bins" ADD CONSTRAINT "bins_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bins" ADD CONSTRAINT "bins_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bins_location_code_key" ON "bins" USING btree ("location_id","code");--> statement-breakpoint
CREATE INDEX "bins_tenant_location_idx" ON "bins" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX "locations_tenant_created_idx" ON "locations" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_tenant_code_key" ON "locations" USING btree ("tenant_id","code");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.bins ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY locations_tenant_isolation ON public.locations
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
CREATE POLICY bins_tenant_isolation ON public.bins
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON locations, bins TO ops_hub_app;
