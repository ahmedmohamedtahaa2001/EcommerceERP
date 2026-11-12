# Ops Hub

[![Ops Hub CI](https://github.com/morluto/rea/actions/workflows/ops-hub-ci.yml/badge.svg)](https://github.com/morluto/rea/actions/workflows/ops-hub-ci.yml)

Multi-tenant e-commerce operations platform. The task board, phases, and
technical baseline live in [`../ROADMAP.md`](../ROADMAP.md); this directory is
the monorepo root described in its "Repository layout" section.

## Prerequisites

- Node.js 20+ (this repository pins the toolchain in the root `.nvmrc`)
- pnpm 10 (`corepack enable pnpm`, or `npm install -g pnpm`)

## Layout

```
ops-hub/
├─ apps/
│  ├─ api/            # Fastify HTTP API + workers
│  ├─ web/            # React ops console
│  └─ mcp/            # MCP server for AI agents
├─ packages/
│  ├─ db/             # Drizzle schema, migrations, RLS policies
│  ├─ domain/         # Pure domain logic
│  ├─ contracts/      # Zod schemas + OpenAPI generation
│  ├─ integrations/   # Storefront, courier, payment, messaging adapters
│  ├─ events/         # Event types, outbox, dispatcher
│  └─ shared/         # Money, phone, dates, i18n, errors, logger
├─ fixtures/          # Fake provider payloads and sample files
├─ docs/decisions/    # Architecture decision records
└─ tests/             # Workspace-level tests
```

## Commands

Run these from this directory after `pnpm install`:

| Command          | What it does                                       |
| ---------------- | -------------------------------------------------- |
| `pnpm lint`      | ESLint over every workspace package                |
| `pnpm typecheck` | `tsc --noEmit` over every workspace package        |
| `pnpm test`      | Vitest across the workspace                        |
| `pnpm build`     | Runs each package's `build` script when it has one |
| `pnpm dev:api`   | Starts the Fastify API on `PORT` (default 3001)    |

All three of `lint`, `typecheck`, and `test` must pass before a task is
committed, per the roadmap's global non-negotiables.

## Local services

`docker compose up -d` starts Postgres 16, Redis 7, and Mailpit (SMTP on
1025, web UI on 8025). `pnpm db:ping` connects to Postgres and Redis and
exits non-zero if either is unreachable. Connection strings default to the
compose values; override them with `DATABASE_URL` and `REDIS_URL` (see
`.env.example`).

### Database

| Command            | What it does                                                |
| ------------------ | ----------------------------------------------------------- |
| `pnpm db:generate` | Generates a Drizzle migration from `packages/db/src/schema` |
| `pnpm db:migrate`  | Applies pending migrations                                  |
| `pnpm db:reset`    | Drops `public` and `drizzle` schemas (development only)     |

The first migration creates `tenants`, `users`, `memberships`, and the
append-only `audit_log`, and grants the `ops_hub_app` role only `SELECT` and
`INSERT` on `audit_log`. See
[`docs/decisions/0001-tenancy-and-audit-model.md`](docs/decisions/0001-tenancy-and-audit-model.md).

### Authentication

`POST /v1/auth/login` takes `{ email, password }` and returns an opaque
session token plus the public user. Send it as `Authorization: Bearer
<token>` to `GET /v1/auth/me`; `POST /v1/auth/logout` revokes it. Sessions
live in Redis (8-hour TTL) and failed logins are limited to 5 per 15 minutes
per email. Passwords are hashed with argon2id and never returned.

Tenant-scoped tables (`tenants`, `memberships`, `audit_log`, `api_keys`) have
RLS enabled. The application must set the tenant per transaction through
the `withTenant(pool, tenantId, work)` helper; without a tenant setting,
queries return no rows. `pnpm test:db` runs the RLS isolation integration
test against the compose database (the default `pnpm test` skips it).

### API keys

`POST /v1/api-keys` (staff session with `api_keys:write`) takes `{ name,
scopes, ipAllowlist? }` and returns the plaintext secret exactly once; only a
SHA-256 hash is stored at rest. Requests authenticate with either
`Authorization: Bearer <secret>` or `X-API-Key: <secret>`; a key acts as a
principal whose permissions come from its scopes, so a call outside its
scopes gets 403 while an unknown or revoked key gets a generic 401. Keys can
optionally be restricted to specific client IPs. `DELETE /v1/api-keys/:id`
revokes, `last_used_at` is stamped on every successful authentication, and
secrets are redacted from logs.

### Audit trail

Every mutating route appends to the append-only `audit_log` (actor, action,
object, before, after) through `recordAudit`; successful logins are audited
too, and the enforcement test in `apps/api/tests/audit-coverage.test.ts`
fails if a mutating route skips it. `GET /v1/audit?object=<type>[:<id>]`
(role `audit:read`) returns entries newest first with a `limit` between 1
and 200.

If pnpm is not installed globally, prefix commands with `npx pnpm@10`
(for example `npx pnpm@10 install`).

## Quick start (from a clean checkout)

```bash
docker compose up -d          # postgres + redis + mailpit
pnpm install
pnpm db:migrate               # apply the schema
pnpm db:seed                  # demo tenant, owner user, catalog, opening stock
pnpm db:seed:password         # hash the demo password with argon2id
pnpm dev:api                  # API on http://localhost:3001
pnpm dev:web                  # ops console on http://localhost:5173
```

Seeded credentials: `owner@ops-hub.local` / `ops-hub-demo-password`.

Smoke check:

```bash
curl http://localhost:3001/healthz
curl http://localhost:3001/v1/openapi.json   # 50 published paths
open http://localhost:3001/docs               # human-readable route list
```

### Useful extras

| Command                               | What it does                                             |
| ------------------------------------- | -------------------------------------------------------- |
| `pnpm test:db`                        | Runs the DB integration suite (needs Postgres)           |
| `npx tsx fixtures/courier/server.ts`  | Fake courier on :4010 (create/status/label/cancel/rates) |
| `node fixtures/webhooks/receiver.mjs` | Sample outbound-webhook receiver on :4020                |
| `pnpm --filter @ops-hub/mcp start`    | MCP server for Claude (stdio)                            |
| `pnpm --filter @ops-hub/web build`    | Builds the ops console                                   |

`BOSTA_BASE_URL` and `BOSTA_API_KEY` point the shipment service at a carrier;
they default to the fake courier and a placeholder key, so nothing calls a
real carrier until you set them.

### What is built

| Area      | Endpoints / modules                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| Platform  | auth, API keys, RBAC, audit log, health probes, rate limiting, OpenAPI (`/v1/openapi.json`, `/docs`)           |
| Catalog   | products, variants, bulk CSV/XLSX import                                                                       |
| Inventory | locations, bins, stock ledger, ATP, reservations, adjustments, receipts, putaway, cycle counts                 |
| Orders    | order intake with idempotency, validation pipeline, duplicate detection, event timeline, exceptions            |
| Shipping  | carrier port, Bosta/Posta/J&T adapters, fake courier, shipments, tracking, webhooks, routing                   |
| Money     | COD records, confirmation tasks, risk scoring, returns, refunds (four-eyes), settlement import, reconciliation |
| Buying    | suppliers, reorder engine, purchase orders, scorecards, landed cost, claims                                    |
| Support   | tickets, channels, inbox, WISMO, macros, CRM profiles, consent, segments, automations, KPIs, alerts            |
| Agents    | MCP server (11 curated tools, approval gating, PII redaction), 3 playbooks, sandbox, safety controls           |

### Environment

| Variable          | Default                  | Used by                      |
| ----------------- | ------------------------ | ---------------------------- |
| `DATABASE_URL`    | compose Postgres         | API, MCP, seed scripts       |
| `REDIS_URL`       | `redis://localhost:6379` | sessions, rate limits, locks |
| `PORT`            | `3001`                   | API                          |
| `BOSTA_API_KEY`   | `placeholder`            | Bosta adapter                |
| `BOSTA_BASE_URL`  | `http://localhost:4010`  | Bosta adapter                |
| `OPS_HUB_API_URL` | `http://localhost:3001`  | MCP server                   |
| `OPS_HUB_API_KEY` | empty                    | MCP server                   |
| `OPS_HUB_SCOPES`  | empty                    | MCP server                   |
