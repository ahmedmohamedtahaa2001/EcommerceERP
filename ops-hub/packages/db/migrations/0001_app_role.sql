-- Application role (NOLOGIN in development). Production provisioning grants it
-- LOGIN credentials out of band; migrations only own its privileges.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ops_hub_app') THEN
    CREATE ROLE ops_hub_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO ops_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, users, memberships TO ops_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit_log TO ops_hub_app;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM ops_hub_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO ops_hub_app;
