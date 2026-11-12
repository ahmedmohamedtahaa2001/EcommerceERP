CREATE TABLE "exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exceptions_tenant_order_idx" ON "exceptions" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "exceptions_tenant_status_idx" ON "exceptions" USING btree ("tenant_id","status");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON exceptions TO ops_hub_app;--> statement-breakpoint
ALTER TABLE public.exceptions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY exceptions_tenant_isolation ON public.exceptions
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());