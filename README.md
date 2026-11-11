# Ops Hub

[![Ops Hub CI](https://github.com/ahmedmohamedtahaa2001/EcommerceERP/actions/workflows/ci.yml/badge.svg)](https://github.com/ahmedmohamedtahaa2001/EcommerceERP/actions/workflows/ci.yml)

Multi-tenant e-commerce operations platform. The task board, phases, and
technical baseline live in [`ROADMAP.md`](ROADMAP.md) at the repository root.

## Prerequisites

- Node.js 20+ (this repository pins the toolchain in the root `.nvmrc`)
- pnpm 10 (`corepack enable pnpm`, or `npm install -g pnpm`)

## Layout

```
.
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

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `pnpm lint`        | ESLint over every workspace package           |
| `pnpm typecheck`   | `tsc --noEmit` over every workspace package   |
| `pnpm test`        | Vitest across the workspace                   |
| `pnpm build`       | Runs each package's `build` script when it has one |
| `pnpm dev:api`     | Starts the Fastify API on `PORT` (default 3001)   |

All three of `lint`, `typecheck`, and `test` must pass before a task is
committed, per the roadmap's global non-negotiables.

## Local services

`docker compose up -d` starts Postgres 16, Redis 7, and Mailpit (SMTP on
1025, web UI on 8025). `pnpm db:ping` connects to Postgres and Redis and
exits non-zero if either is unreachable. Connection strings default to the
compose values; override them with `DATABASE_URL` and `REDIS_URL` (see
`.env.example`).

### Database

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `pnpm db:generate` | Generates a Drizzle migration from `packages/db/src/schema` |
| `pnpm db:migrate`  | Applies pending migrations                                |
| `pnpm db:reset`    | Drops `public` and `drizzle` schemas (development only)   |

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

### Catalog

`POST /v1/products` creates a product (`simple` or `bundle`) with AR/EN names,
descriptions, images, and status (`draft`/`active`/`archived`); `GET /v1/products`
lists with `limit`/`offset`; `GET /v1/products/:id` returns the product with its
variants and (for bundles) components; `PATCH`/`DELETE` update or remove. A
product that still has stock movements cannot be deleted (409).

Variants hang off a product: `POST /v1/products/:id/variants` with a unique
`sku` (unique per tenant — duplicate returns 409) plus optional `attributes`
and `images`; `PATCH /v1/variants/:id` and `DELETE /v1/variants/:id`. A SKU
becomes immutable once any stock movement references the variant (409 on
attempted change). Bundles attach components via `PUT /v1/products/:id/components`
(full replace) and `GET /v1/products/:id/components`.

Every mutating route appends to the append-only `audit_log` (actor, action,
object, before, after) through `recordAudit`; successful logins are audited
too, and the enforcement test in `apps/api/tests/audit-coverage.test.ts`
fails if a mutating route skips it. `GET /v1/audit?object=<type>[:<id>]`
(role `audit:read`) returns entries newest first with a `limit` between 1
and 200.

If pnpm is not installed globally, prefix commands with `npx pnpm@10`
(for example `npx pnpm@10 install`).
