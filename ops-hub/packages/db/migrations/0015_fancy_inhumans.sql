CREATE TABLE "cod_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"outcome" text NOT NULL,
	"response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cod_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"outcome" text,
	"due_at" timestamp with time zone NOT NULL,
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"token_expires_at" timestamp with time zone,
	"error_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"classification" text DEFAULT 'C' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"expected_qty" integer DEFAULT 0 NOT NULL,
	"counted_qty" integer,
	"adjustment_id" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"counted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dlq_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'dead' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replayed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"receipt_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"expected_qty" integer,
	"received_qty" integer DEFAULT 0 NOT NULL,
	"damaged_qty" integer DEFAULT 0 NOT NULL,
	"substitution_sku" text,
	"released_bin_id" uuid,
	"released_qty" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"po_id" uuid,
	"location_id" uuid NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"return_id" uuid,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"requested_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "return_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"return_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"reason_code" text NOT NULL,
	"disposition" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"file_hash" text NOT NULL,
	"carrier" text NOT NULL,
	"line_count" integer DEFAULT 0 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"tracking_number" text NOT NULL,
	"order_id" uuid,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"deduction_type" text,
	"deduction_minor" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cod_attempts" ADD CONSTRAINT "cod_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_attempts" ADD CONSTRAINT "cod_attempts_task_id_cod_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."cod_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_tasks" ADD CONSTRAINT "cod_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_tasks" ADD CONSTRAINT "cod_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dlq_entries" ADD CONSTRAINT "dlq_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_lines" ADD CONSTRAINT "receipt_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_lines" ADD CONSTRAINT "receipt_lines_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_lines" ADD CONSTRAINT "receipt_lines_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_files" ADD CONSTRAINT "settlement_files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_file_id_settlement_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."settlement_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cod_attempts_tenant_task_idx" ON "cod_attempts" USING btree ("tenant_id","task_id");--> statement-breakpoint
CREATE INDEX "cod_tasks_tenant_status_idx" ON "cod_tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "cod_tasks_tenant_order_idx" ON "cod_tasks" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "connectors_tenant_idx" ON "connectors" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "cycle_counts_tenant_status_idx" ON "cycle_counts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "cycle_counts_tenant_location_idx" ON "cycle_counts" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX "dlq_entries_tenant_status_idx" ON "dlq_entries" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "receipt_lines_tenant_receipt_idx" ON "receipt_lines" USING btree ("tenant_id","receipt_id");--> statement-breakpoint
CREATE INDEX "receipts_tenant_status_idx" ON "receipts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "refunds_tenant_status_idx" ON "refunds" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "refunds_tenant_order_idx" ON "refunds" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "return_lines_tenant_return_idx" ON "return_lines" USING btree ("tenant_id","return_id");--> statement-breakpoint
CREATE INDEX "returns_tenant_status_idx" ON "returns" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "returns_tenant_order_idx" ON "returns" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "risk_scores_tenant_order_idx" ON "risk_scores" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "settlement_files_tenant_idx" ON "settlement_files" USING btree ("tenant_id","tenant_id");--> statement-breakpoint
CREATE INDEX "settlement_lines_tenant_file_idx" ON "settlement_lines" USING btree ("tenant_id","file_id");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON receipts TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY receipts_tenant_isolation ON public.receipts
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON receipt_lines TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.receipt_lines ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY receipt_lines_tenant_isolation ON public.receipt_lines
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON cycle_counts TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.cycle_counts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY cycle_counts_tenant_isolation ON public.cycle_counts
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON cod_tasks TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.cod_tasks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY cod_tasks_tenant_isolation ON public.cod_tasks
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON cod_attempts TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.cod_attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY cod_attempts_tenant_isolation ON public.cod_attempts
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON risk_scores TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY risk_scores_tenant_isolation ON public.risk_scores
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON returns TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY returns_tenant_isolation ON public.returns
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON return_lines TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.return_lines ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY return_lines_tenant_isolation ON public.return_lines
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON refunds TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY refunds_tenant_isolation ON public.refunds
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON settlement_files TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.settlement_files ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY settlement_files_tenant_isolation ON public.settlement_files
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON settlement_lines TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.settlement_lines ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY settlement_lines_tenant_isolation ON public.settlement_lines
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON connectors TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY connectors_tenant_isolation ON public.connectors
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON dlq_entries TO ops_hub_app;
--> statement-breakpoint
ALTER TABLE public.dlq_entries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dlq_entries_tenant_isolation ON public.dlq_entries
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
