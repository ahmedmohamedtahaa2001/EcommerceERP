ALTER TABLE "exceptions" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "due_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "overdue_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exceptions_tenant_due_idx" ON "exceptions" USING btree ("tenant_id","status","due_at");