DROP INDEX "bin_stock_tenant_variant_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "bin_stock_tenant_bin_variant_key" ON "bin_stock" USING btree ("tenant_id","bin_id","variant_id");
