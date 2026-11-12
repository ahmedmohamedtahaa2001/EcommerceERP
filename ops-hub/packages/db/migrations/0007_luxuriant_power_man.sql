CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text,
	"governorate_code" text,
	"raw_governorate" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"full_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"currency" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_number_counters" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"address_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"channel" text DEFAULT 'manual' NOT NULL,
	"external_order_id" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"method" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_number_counters" ADD CONSTRAINT "order_number_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_tenant_customer_idx" ON "addresses" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_phone_key" ON "customers" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "order_lines_tenant_order_idx" ON "order_lines" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_order_number_key" ON "orders" USING btree ("tenant_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_idempotency_key_key" ON "orders" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_tenant_customer_idx" ON "orders" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_status_idx" ON "orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "payments_tenant_order_idx" ON "payments" USING btree ("tenant_id","order_id");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON customers, addresses, orders, order_lines, payments, order_number_counters TO ops_hub_app;--> statement-breakpoint
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY customers_tenant_isolation ON public.customers
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY addresses_tenant_isolation ON public.addresses
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY orders_tenant_isolation ON public.orders
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY order_lines_tenant_isolation ON public.order_lines
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY payments_tenant_isolation ON public.payments
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
ALTER TABLE public.order_number_counters ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY order_number_counters_tenant_isolation ON public.order_number_counters
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());