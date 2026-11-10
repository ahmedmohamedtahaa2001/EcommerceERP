-- Tenant scope comes from `app.tenant_id`, set transaction-locally by the
-- application. With no setting, the cast is NULL and every policy fails closed.
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;
--> statement-breakpoint
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenants_tenant_isolation ON public.tenants
  USING (id = public.current_tenant_id())
  WITH CHECK (id = public.current_tenant_id());
--> statement-breakpoint
CREATE POLICY memberships_tenant_isolation ON public.memberships
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
CREATE POLICY audit_log_tenant_isolation ON public.audit_log
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO ops_hub_app;
