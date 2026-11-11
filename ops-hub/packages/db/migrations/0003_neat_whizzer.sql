CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"ip_allowlist" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_tenant_created_idx" ON "api_keys" USING btree ("tenant_id","created_at");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO ops_hub_app;--> statement-breakpoint
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY api_keys_tenant_isolation ON public.api_keys
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());--> statement-breakpoint
-- Authentication must look a key up by its hash before any tenant is known.
-- The SECURITY DEFINER function runs as the table owner (which is not forced
-- under RLS), so the global lookup works no matter which role the pool uses;
-- every other access stays tenant-scoped by the policy above.
CREATE OR REPLACE FUNCTION public.find_api_key_by_hash(p_key_hash text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  name text,
  key_hash text,
  key_prefix text,
  scopes jsonb,
  ip_allowlist jsonb,
  created_by uuid,
  created_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.api_keys
     SET last_used_at = now()
   WHERE key_hash = p_key_hash
     AND revoked_at IS NULL
  RETURNING
    api_keys.id,
    api_keys.tenant_id,
    api_keys.name,
    api_keys.key_hash,
    api_keys.key_prefix,
    api_keys.scopes,
    api_keys.ip_allowlist,
    api_keys.created_by,
    api_keys.created_at,
    api_keys.last_used_at,
    api_keys.revoked_at;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.find_api_key_by_hash(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.find_api_key_by_hash(text) TO ops_hub_app;