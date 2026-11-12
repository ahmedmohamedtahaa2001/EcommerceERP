CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"trigger_event" text NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_scorecards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"carrier" text NOT NULL,
	"governorate_code" text NOT NULL,
	"service" text DEFAULT 'standard' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"on_time_rate" integer DEFAULT 0 NOT NULL,
	"first_attempt_rate" integer DEFAULT 0 NOT NULL,
	"exception_rate" integer DEFAULT 0 NOT NULL,
	"cost_per_shipment_minor" integer DEFAULT 0 NOT NULL,
	"claims" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"max_attachment_bytes" integer DEFAULT 10485760 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"carrier" text NOT NULL,
	"shipment_id" uuid,
	"type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"description" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"waived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"merged_into_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" text NOT NULL,
	"metric" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landed_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"po_id" uuid NOT NULL,
	"po_line_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"allocation_basis" text DEFAULT 'value' NOT NULL,
	"allocated_cost_minor" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "macros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"ar" text NOT NULL,
	"en" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "po_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"po_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "po_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"po_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost_minor" integer DEFAULT 0 NOT NULL,
	"received_qty" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"expected_at" timestamp with time zone,
	"created_by" uuid,
	"approved_by" uuid,
	"sent_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_scorecards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"ack_time_hours" integer DEFAULT 0 NOT NULL,
	"otif_rate" integer DEFAULT 0 NOT NULL,
	"fill_rate" integer DEFAULT 0 NOT NULL,
	"damage_rate" integer DEFAULT 0 NOT NULL,
	"cost_variance_minor" integer DEFAULT 0 NOT NULL,
	"claim_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_skus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"supplier_sku" text NOT NULL,
	"pack_size" integer DEFAULT 1 NOT NULL,
	"is_backup" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"actual_lead_time_days" integer DEFAULT 0 NOT NULL,
	"moq" integer DEFAULT 1 NOT NULL,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"documents_checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_backup" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"channel" text DEFAULT 'internal' NOT NULL,
	"direction" text DEFAULT 'inbound' NOT NULL,
	"body" text NOT NULL,
	"internal" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"order_id" uuid,
	"shipment_id" uuid,
	"type" text DEFAULT 'general' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"owner_id" uuid,
	"sla_due_at" timestamp with time zone NOT NULL,
	"escalated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_scorecards" ADD CONSTRAINT "carrier_scorecards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_po_line_id_po_lines_id_fk" FOREIGN KEY ("po_line_id") REFERENCES "public"."po_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "macros" ADD CONSTRAINT "macros_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_events" ADD CONSTRAINT "po_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_events" ADD CONSTRAINT "po_events_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_members" ADD CONSTRAINT "segment_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_members" ADD CONSTRAINT "segment_members_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_scorecards" ADD CONSTRAINT "supplier_scorecards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_scorecards" ADD CONSTRAINT "supplier_scorecards_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_skus" ADD CONSTRAINT "supplier_skus_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_skus" ADD CONSTRAINT "supplier_skus_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_skus" ADD CONSTRAINT "supplier_skus_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_tenant_kind_idx" ON "alerts" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE INDEX "automation_runs_tenant_automation_idx" ON "automation_runs" USING btree ("tenant_id","automation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automations_tenant_key_key" ON "automations" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "carrier_scorecards_tenant_carrier_idx" ON "carrier_scorecards" USING btree ("tenant_id","carrier");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_tenant_type_name_key" ON "channels" USING btree ("tenant_id","type","name");--> statement-breakpoint
CREATE INDEX "claims_tenant_status_idx" ON "claims" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "consents_tenant_customer_idx" ON "consents" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "conversations_tenant_customer_idx" ON "conversations" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "customer_profiles_tenant_customer_idx" ON "customer_profiles" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_snapshots_tenant_date_metric_key" ON "kpi_snapshots" USING btree ("tenant_id","date","metric");--> statement-breakpoint
CREATE INDEX "landed_costs_tenant_po_idx" ON "landed_costs" USING btree ("tenant_id","po_id");--> statement-breakpoint
CREATE UNIQUE INDEX "macros_tenant_key_key" ON "macros" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "po_events_tenant_po_idx" ON "po_events" USING btree ("tenant_id","po_id");--> statement-breakpoint
CREATE INDEX "po_lines_tenant_po_idx" ON "po_lines" USING btree ("tenant_id","po_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_tenant_number_key" ON "purchase_orders" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "purchase_orders_tenant_status_idx" ON "purchase_orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "segment_members_tenant_segment_idx" ON "segment_members" USING btree ("tenant_id","segment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "segments_tenant_key_key" ON "segments" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "supplier_scorecards_tenant_supplier_idx" ON "supplier_scorecards" USING btree ("tenant_id","supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_skus_tenant_variant_idx" ON "supplier_skus" USING btree ("tenant_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_tenant_name_key" ON "suppliers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "ticket_messages_tenant_ticket_idx" ON "ticket_messages" USING btree ("tenant_id","ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_tenant_status_idx" ON "tickets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tickets_tenant_priority_idx" ON "tickets" USING btree ("tenant_id","priority");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON alerts TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY alerts_tenant_isolation ON public.alerts
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON automation_runs TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY automation_runs_tenant_isolation ON public.automation_runs
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON automations TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY automations_tenant_isolation ON public.automations
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON carrier_scorecards TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.carrier_scorecards ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY carrier_scorecards_tenant_isolation ON public.carrier_scorecards
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON channels TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY channels_tenant_isolation ON public.channels
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON claims TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY claims_tenant_isolation ON public.claims
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON consents TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY consents_tenant_isolation ON public.consents
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON conversations TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY conversations_tenant_isolation ON public.conversations
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON customer_profiles TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY customer_profiles_tenant_isolation ON public.customer_profiles
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON kpi_snapshots TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY kpi_snapshots_tenant_isolation ON public.kpi_snapshots
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON landed_costs TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.landed_costs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY landed_costs_tenant_isolation ON public.landed_costs
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON macros TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.macros ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY macros_tenant_isolation ON public.macros
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON po_events TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.po_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY po_events_tenant_isolation ON public.po_events
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON po_lines TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.po_lines ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY po_lines_tenant_isolation ON public.po_lines
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON purchase_orders TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY purchase_orders_tenant_isolation ON public.purchase_orders
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON segment_members TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.segment_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY segment_members_tenant_isolation ON public.segment_members
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON segments TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY segments_tenant_isolation ON public.segments
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON supplier_scorecards TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.supplier_scorecards ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY supplier_scorecards_tenant_isolation ON public.supplier_scorecards
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON supplier_skus TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.supplier_skus ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY supplier_skus_tenant_isolation ON public.supplier_skus
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON suppliers TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY suppliers_tenant_isolation ON public.suppliers
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ticket_messages TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY ticket_messages_tenant_isolation ON public.ticket_messages
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON tickets TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tickets_tenant_isolation ON public.tickets
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
