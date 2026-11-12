CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid,
	"template_key" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"recipient" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_tenant_order_template_key" ON "notifications" USING btree ("tenant_id","order_id","template_key");
--> statement-breakpoint
GRANT SELECT, INSERT ON notifications TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY notifications_tenant_isolation ON public.notifications
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
