ALTER TABLE "stock_reservations" ADD COLUMN "order_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_reservations_tenant_order_idx" ON "stock_reservations" ("tenant_id","order_id") WHERE "order_id" IS NOT NULL;
