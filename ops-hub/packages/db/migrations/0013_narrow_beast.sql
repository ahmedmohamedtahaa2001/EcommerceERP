CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"carrier_status" text NOT NULL,
	"status" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"location" text,
	"description" text,
	"raw" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"shipment_id" uuid,
	"idempotency_key" text NOT NULL,
	"request_body" text,
	"response_body" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"carrier" text NOT NULL,
	"carrier_shipment_id" text,
	"tracking_number" text,
	"status" text DEFAULT 'label_created' NOT NULL,
	"service_level" text,
	"label_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_requests" ADD CONSTRAINT "shipment_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_requests" ADD CONSTRAINT "shipment_requests_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipment_events_tenant_shipment_idx" ON "shipment_events" USING btree ("tenant_id","shipment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "shipment_requests_tenant_shipment_idx" ON "shipment_requests" USING btree ("tenant_id","shipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_tenant_order_sequence_key" ON "shipments" USING btree ("tenant_id","order_id","sequence");--> statement-breakpoint
CREATE INDEX "shipments_tenant_order_idx" ON "shipments" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "shipments_tenant_status_idx" ON "shipments" USING btree ("tenant_id","status");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON shipments TO ops_hub_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON shipment_requests TO ops_hub_app;--> statement-breakpoint
GRANT SELECT, INSERT ON shipment_events TO ops_hub_app;--> statement-breakpoint
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.shipment_requests ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY shipments_tenant_isolation ON public.shipments
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
CREATE POLICY shipment_requests_tenant_isolation ON public.shipment_requests
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
CREATE POLICY shipment_events_tenant_isolation ON public.shipment_events
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
