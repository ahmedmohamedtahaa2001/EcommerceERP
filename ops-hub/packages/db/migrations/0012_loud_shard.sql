CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"note" text,
	"customer_visible" boolean DEFAULT false NOT NULL,
	"actor_type" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_events_tenant_order_idx" ON "order_events" USING btree ("tenant_id","order_id","created_at");--> statement-breakpoint
GRANT SELECT, INSERT ON order_events TO ops_hub_app;--> statement-breakpoint
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY order_events_tenant_isolation ON public.order_events
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());