# 0001 — Tenancy and audit model

- Status: accepted
- Date: 2026-11-10
- Task: P0-S1-T03

## Context

The roadmap's global rule says every table has `tenant_id` and Row-Level
Security enabled. The foundation tables are `tenants`, `users`, `memberships`,
and `audit_log`.

## Decision

1. **`users` is a global identity table.** It has no `tenant_id`. Tenant
   scoping is carried by `memberships (tenant_id, user_id, role)`, so one
   person can belong to several tenants without duplicating their identity.
   `users.email` is unique case-insensitively (`lower(email)`).
2. **`audit_log` has `tenant_id` but no foreign key to `tenants`.** Audit rows
   describe objects that may later be deleted; a cascade would destroy the
   trail, and a restrict would block legitimate deletion. The tenant id is
   recorded as an immutable value.
3. **`audit_log` is append-only for the application role.** Migration
   `0001_app_role.sql` grants `ops_hub_app` only `SELECT` and `INSERT` on
   `audit_log`, plus `USAGE, SELECT` on its sequence. `UPDATE`, `DELETE`, and
   `TRUNCATE` are explicitly revoked. The role is created `NOLOGIN` in
   development; real credentials are provisioned out of band.
4. **Migrations are reversible in development** through `pnpm db:reset`, which
   drops the `public` and `drizzle` schemas (the latter holds Drizzle's
   journal) and lets `pnpm db:migrate` reapply from zero.

## Consequences

- The blanket "every table has `tenant_id`" rule is satisfied by
  `memberships`, not by `users`; RLS work in P0-S1-T04 must authorize `users`
  access through membership, never through a column on `users`.
- Audit rows survive tenant deletion; retention and erasure policy is deferred
  to X-04 (personal data policy).
- `ops_hub_app` still has full DML on the other three tables until RLS lands in
  P0-S1-T04.
