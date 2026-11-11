# Ops Hub — Roadmap, Phases, Sprints & Task Board

> Source of truth for the coding agent. Read this file first, every session.
> Companion doc: `ecommerce-ops-system-architecture.md` (the "why" and the design).
> This file is the "what" and the "in what order", and it is where progress is tracked.

---

## 0. Agent operating rules (read before touching code)

1. **Pick the next task**: the first task in the current sprint whose status is `[ ]` and whose dependencies are all `[x]`. Work on one task at a time.
2. **Status markers**:
   - `[ ]` not started
   - `[~]` in progress (write your name/session in the task's `Owner` line)
   - `[x]` done (acceptance criteria met AND tests pass)
   - `[!]` blocked (add a `Blocker:` line explaining exactly what is needed from a human)
3. **Do not mark `[x]`** unless every acceptance criterion is verified by an automated test or an explicit command output you can paste into the progress log.
4. **One task = one commit.** Commit message format: `[P0-S1-T03] short description`.
5. **Do not change scope silently.** Good ideas that are not in this file go to Section 14 (Backlog). Do not implement them.
6. **Update the Progress Log (Section 15)** at the end of every task: date, task ID, one-line summary, commit hash.
7. **If a task reveals that a dependency is wrong or missing**, do not work around it. Mark the task `[!]` and add a new task to the sprint describing the gap.
8. **Never** commit secrets, real API keys, real customer data, or `.env` files.

### Global non-negotiables (apply to every task)

- Every table has `tenant_id` and Row-Level Security enabled.
- Every write endpoint that creates or triggers something accepts `Idempotency-Key` and is tested for duplicate calls.
- Every state change writes an audit entry (actor, action, object, before, after, timestamp).
- Every state change emits a domain event through the transactional outbox (same DB transaction).
- Money is stored as integer minor units (piastres) plus currency code. Never floats.
- Phone numbers are normalized to E.164 (`+20XXXXXXXXXX`) on input. Raw input is kept for audit.
- User-facing strings are i18n keys with Arabic and English values.
- Lint, typecheck, and unit tests pass before any commit.

---

## 1. Tech baseline (decided, do not re-debate)

| Concern | Choice |
|---|---|
| Language | TypeScript everywhere (Node 20+) |
| Monorepo | pnpm workspaces |
| Backend | Fastify + Zod for validation |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Database | PostgreSQL 16 (RLS enabled) |
| Queue / jobs | pg-boss (Postgres-backed) |
| Cache / locks | Redis (idempotency keys, short locks) |
| Frontend | React + Vite + Tailwind + TanStack Query |
| API docs | OpenAPI 3.1 generated from Zod schemas |
| Testing | Vitest (unit + integration), Supertest for HTTP, Playwright for E2E (from Phase 1) |
| Logging / errors | pino (structured JSON), Sentry-compatible error tracking |
| Local dev | Docker Compose: postgres, redis, mailpit, and a fake courier server |

### Repository layout (target)

```
. (repository root)
├─ apps/
│  ├─ api/                # Fastify HTTP API + workers
│  ├─ web/                # React app (ops console)
│  └─ mcp/                # MCP server for AI agents (Phase 4)
├─ packages/
│  ├─ db/                 # Drizzle schema, migrations, RLS policies
│  ├─ domain/             # Pure domain logic: state machines, stock math, rules
│  ├─ contracts/          # Zod schemas + OpenAPI generation
│  ├─ integrations/       # Adapters: storefronts, couriers, payments, messaging
│  ├─ events/             # Event types, outbox, dispatcher
│  └─ shared/             # Money, phone, dates, i18n, errors, logger
├─ fixtures/              # Fake courier payloads, Shopify webhook samples, settlement files
├─ docs/
│  └─ decisions/          # ADRs (one file per decision)
├─ ROADMAP.md             # this file
├─ CHANGELOG.md
└─ docker-compose.yml
```

---

## 2. Phase overview

| Phase | Name | Sprints | Exit criteria (all must be true) |
|---|---|---|---|
| **P0** | Foundation | S1–S2 | Tenants, auth, API keys, audit, outbox, catalog, stock ledger, OpenAPI published |
| **P1** | Core Ops MVP | S3–S5 | Shopify orders in, state machine + exception queue, Bosta shipments with idempotent labels, tracking page, COD basics, one pilot brand live |
| **P2** | Reliability & Money | S6–S8 | Receiving with PO match, putaway, cycle counts, COD confirmation + risk score, returns/refunds, daily reconciliation, DLQ replay, Posta + J&T adapters |
| **P3** | Growth | S9–S12 | Reorder engine, POs, supplier scorecards, landed cost, unified inbox (WhatsApp/IG/email), CRM profiles, segments, automations, KPI dashboards |
| **P4** | Intelligence & Ecosystem | S13–S15 | MCP server, agent playbooks, n8n/Make templates, accounting export, public API hardening |

### Sprint calendar

Each sprint is 2 weeks. Dates are relative; set real dates when the sprint starts.

| Sprint | Phase | Theme |
|---|---|---|
| S1 | P0 | Repo, platform, tenants, auth, API keys |
| S2 | P0 | Catalog, locations, stock ledger, OpenAPI |
| S3 | P1 | Order intake, validation, duplicates, state machine |
| S4 | P1 | Bosta adapter, shipments, tracking normalization, outbound webhooks |
| S5 | P1 | Shopify connector, COD basics, tracking page, pilot launch |
| S6 | P2 | Receiving, PO matching, putaway, quarantine, cycle counts |
| S7 | P2 | COD confirmation, risk scoring, returns and refunds |
| S8 | P2 | Settlement reconciliation, reconciler, DLQ replay, Posta + J&T |
| S9 | P3 | Purchase orders, reorder engine, supplier master |
| S10 | P3 | Supplier scorecards, landed cost, carrier scorecards |
| S11 | P3 | Unified inbox, WhatsApp channel, tickets, macros |
| S12 | P3 | CRM profiles, segments, automations, KPI dashboards and alerts |
| S13 | P4 | Public API hardening, rate limits, API docs site, sandbox |
| S14 | P4 | MCP server for Claude and other agents |
| S15 | P4 | Agent playbooks, n8n/Make templates, accounting export |

---

## 3. Phase 0 — Foundation

**Goal:** a secure, multi-tenant, API-first base where every later feature can plug in without rework.

### Sprint 1 (S1) — Repo, platform, tenants, auth, API keys

**Sprint goal:** a logged-in staff user and a scoped API key can both call a protected endpoint, and every action is audited.

- [x] **P0-S1-T01** Initialize pnpm monorepo with the layout in Section 1.
  - Owner: buffy (2026-11-10)
  - Deps: none
  - AC: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` run green on empty packages. Root `README.md` explains how to run them.

- [x] **P0-S1-T02** Docker Compose for postgres 16, redis 7, mailpit.
  - Owner: buffy (2026-11-10)
  - Deps: T01
  - AC: `docker compose up -d` starts all services; a `pnpm db:ping` script connects successfully.

- [x] **P0-S1-T03** Drizzle setup and first migration: `tenants`, `users`, `memberships`, `audit_log`.
  - Owner: buffy (2026-11-10)
  - Deps: T02
  - AC: `pnpm db:migrate` creates the tables; `audit_log` is append-only (UPDATE and DELETE revoked for app role); migration is reversible in dev.

- [x] **P0-S1-T04** Row-Level Security framework.
  - Owner: buffy (2026-11-10)
  - Deps: T03
  - AC: every tenant-scoped table has RLS enabled; the app sets `app.tenant_id` per request via a transaction-scoped setting; integration test proves tenant A cannot read tenant B rows even with a raw query.

- [x] **P0-S1-T05** Shared package: `Money` (integer piastres + currency), `PhoneEG.normalize()`, `Clock` abstraction, error types, `i18n` keys with `ar` and `en`.
  - Owner: buffy (2026-11-10)
  - Deps: T01
  - AC: unit tests cover `01012345678`, `+201012345678`, `0020 10 1234 5678`, and invalid input. Money rejects float input.

- [x] **P0-S1-T06** Fastify app skeleton: request ID, pino logging with redaction (phone, email, api keys), error handler returning RFC 7807 problem JSON, health endpoints `/healthz` and `/readyz`.
  - Owner: buffy (2026-11-10)
  - Deps: T05
  - AC: `GET /healthz` 200; error responses match RFC 7807 shape; logs never contain raw API keys (test with a canary value).

- [x] **P0-S1-T07** Staff authentication: email + password (argon2id), sessions in Redis, login/logout/me endpoints.
  - Owner: buffy (2026-11-10)
  - Deps: T04, T06
  - AC: wrong password returns generic error; session expires; password hash never returned; login attempts rate-limited (5 per 15 min per email).

- [x] **P0-S1-T08** Roles and permissions model (RBAC): roles `owner`, `manager`, `sales_agent`, `warehouse`, `finance`, `support`, `viewer`; permission strings like `orders:read`, `orders:write`, `refunds:approve`.
  - Owner: buffy (2026-11-10)
  - Deps: T07
  - AC: a permission guard decorator/middleware; unit tests for each role's allowed and denied actions.

- [x] **P0-S1-T09** API keys: create (shown once), hash at rest, scopes, optional IP allow-list, revoke, `last_used_at`.
  - Owner: buffy (2026-11-11)
  - Deps: T08
  - AC: `POST /v1/api-keys` returns the secret once; `Authorization: Bearer` and `X-API-Key` both work; revoked key gets 401; scope violation gets 403; keys never appear in logs.

- [x] **P0-S1-T10** Audit writer: a single `audit.record(ctx, action, object, before, after)` used by every mutating service.
  - Owner: buffy (2026-11-11)
  - Deps: T03, T09
  - AC: `GET /v1/audit?object=...` returns entries; a lint rule or test fails if a mutating route does not call the audit writer.

- [!] **P0-S1-T11** CI pipeline (GitHub Actions): install, lint, typecheck, unit, integration (with service containers), migrations dry-run.
  - Owner: buffy (2026-11-11)
  - Deps: T01–T10 (incremental)
  - AC: pull requests fail on any red step; badge in README.
  - Blocker: the workflow (`.github/workflows/ops-hub-ci.yml`) is committed and its full step sequence was executed locally with green output (lint, typecheck, migrate, drift dry-run, 14/14 test files / 133/133 tests), but the "pull requests fail on any red step" AC and the README badge can only be observed on GitHub after a push. `origin` (`morluto/rea`) is currently 23 commits ahead-local / 379 behind — diverged. A human must decide how to reconcile the history (rebase/merge) and push; once CI runs on GitHub and the badge renders, flip this to `[x]`.

**Sprint 1 demo:** create a tenant, log in as owner, create an API key with `orders:read`, call `GET /v1/orders` with the key (200), call a write with the same key (403), and show the audit trail.

---

### Sprint 2 (S2) — Catalog, locations, stock ledger, OpenAPI

**Sprint goal:** products and stock exist per location, every stock change is a movement, and available-to-promise is correct.

- [ ] **P0-S2-T01** Catalog tables and API: `products`, `variants` (SKU unique per tenant), `bundles` (components), with AR/EN names and images.
  - Deps: S1 complete
  - AC: CRUD endpoints with validation; SKU immutable after first stock movement (enforced + tested); duplicate SKU returns 409.

- [ ] **P0-S2-T02** Bulk product import from CSV/XLSX with dry-run and row-level error report.
  - Deps: T01
  - AC: import 1,000-row fixture in under 10 seconds; invalid rows reported with row number and reason; dry-run writes nothing.

- [ ] **P0-S2-T03** Locations and bins: `locations` (warehouse, 3PL, shop, transit) with governorate code; `bins` with zone, code, capacity.
  - Deps: T01
  - AC: bin code unique per location; deleting a location with stock is rejected.

- [ ] **P0-S2-T04** Geo reference data: Egyptian governorates and common districts with canonical codes, AR and EN names, and spelling variants (e.g., "Giza", "الجيزة", "Gizeh").
  - Deps: T01
  - AC: `GET /v1/geo/governorates` and `/v1/geo/districts` exist; `resolveGovernorate("gizeh")` returns the canonical code (unit tests).

- [ ] **P0-S2-T05** Stock ledger: `stock_movements` (append-only), `stock_balances` (derived per sku+location+bucket), buckets: on_hand, reserved, quarantined, damaged, in_transit.
  - Deps: T01, T03
  - AC: no endpoint updates balances directly; every change creates a movement with reason code and actor; balances equal the sum of movements (property test with random sequences).

- [ ] **P0-S2-T06** Availability API: `available_to_promise = on_hand − reserved − quarantined − damaged`, per SKU and location, plus a total across locations.
  - Deps: T05
  - AC: `GET /v1/inventory/availability?sku=&location=`; unit test for each bucket combination; never returns a negative ATP unless negative-stock policy is set to allow.

- [ ] **P0-S2-T07** Reservations: create, release, expire (Redis-backed lock per sku+location during allocation; expiry job).
  - Deps: T05, T06
  - AC: two concurrent reservations for the last unit: exactly one succeeds (integration test with parallel requests); expired reservation returns stock to available.

- [ ] **P0-S2-T08** Adjustments endpoint with mandatory reason codes (`COUNT_VARIANCE`, `DAMAGE`, `LOSS`, `FOUND`, `CORRECTION`) and enum from `GET /v1/meta/enums`.
  - Deps: T05
  - AC: adjustment without reason returns 422; reason enum is served from one source used by both API and validation.

- [ ] **P0-S2-T09** Outbox and event dispatcher: `outbox_events` written in the same transaction as domain changes; a worker publishes to pg-boss with at-least-once delivery and consumer idempotency via `event_id`.
  - Deps: T03
  - AC: kill the worker mid-batch; no event lost; a duplicated delivery is processed once by a test consumer.

- [ ] **P0-S2-T10** Outbound webhook subscriptions: `webhook_subscriptions` (url, events, secret), HMAC-SHA256 signing, retries with exponential backoff, delivery log, manual replay.
  - Deps: T09
  - AC: signature verifiable by a sample receiver script in `fixtures/`; failed delivery retried 5 times then marked failed; replay endpoint works.

- [ ] **P0-S2-T11** OpenAPI 3.1 generated from Zod contracts; served at `/v1/openapi.json` and `/docs`.
  - Deps: S1 endpoints
  - AC: every route in `packages/contracts` appears in the spec; a CI check fails if a route is missing from the spec.

**Sprint 2 demo:** create 3 SKUs, receive stock into two locations, reserve the last unit from two parallel requests (one wins), show `available_to_promise`, show the movement history, and open `/docs`.

**Phase 0 exit check:** all S1 and S2 tasks `[x]`; RLS test suite green; OpenAPI published; CI green on main.

---

## 4. Phase 1 — Core Ops MVP

**Goal:** a real brand (pilot) can take Shopify orders, confirm and ship COD orders with Bosta, see tracking, and nothing gets stuck silently.

### Sprint 3 (S3) — Order intake, validation, duplicates, state machine

**Sprint goal:** orders enter from the API with idempotency, get validated, detect duplicates, and move through a valid state machine. Invalid transitions are rejected.

- [ ] **P1-S3-T01** Orders schema: `orders`, `order_lines`, `customers` (phone E.164, identity key), `addresses`, `payments` (method, amount, status).
  - Deps: P0 complete
  - AC: migrations apply; RLS on all tables; order number generated per tenant (`OP-10001`, sequential, gap-free).

- [ ] **P1-S3-T02** Order state machine in `packages/domain`: states from architecture doc Section 6.2; transition table; invalid transitions throw `InvalidTransitionError`.
  - Deps: T01
  - AC: pure unit tests cover every allowed transition and at least 20 forbidden ones; `label_created` cannot transition to `delivered` directly; no DB or HTTP in this package.

- [ ] **P1-S3-T03** `POST /v1/orders` with `Idempotency-Key`, Zod validation, customer upsert by normalized phone, address with governorate resolution.
  - Deps: T01, T02, P0-S1-T05, P0-S2-T04
  - AC: same key twice returns the same order (201 then 200 with identical body); same key with different body returns 422; phone `01012345678` and `+201012345678` map to one customer.

- [ ] **P1-S3-T04** Order validation pipeline: address completeness, phone validity, product exists, stock available (allocate reservation), payment method allowed.
  - Deps: T03, P0-S2-T07
  - AC: each failed check produces a specific reason code; success moves order to `validated`; failure moves it to `on_hold` with an exception record.

- [ ] **P1-S3-T05** Duplicate detection: same normalized phone + same SKU set within a configurable window, or same `external_order_id` per channel.
  - Deps: T03
  - AC: duplicate is flagged, never auto-merged; creates an exception `DUPLICATE_SUSPECTED`; the reviewer can accept (keep both) or merge via explicit endpoint with audit.

- [ ] **P1-S3-T06** Exceptions module: `exceptions` table (reason_code, owner_id, status, due_at, resolution), endpoints to list, assign, resolve; SLA timer job marks overdue.
  - Deps: T01, P0-S1-T08
  - AC: exception cannot be created without reason and due date; overdue job emits `exception.overdue` event; test with fake clock.

- [ ] **P1-S3-T07** Order events timeline: every transition and note is stored in `order_events` (internal vs customer-visible note flag).
  - Deps: T02, P0-S1-T10
  - AC: `GET /v1/orders/{id}/events` returns ordered timeline; customer-visible notes are filterable.

**Sprint 3 demo:** post the same order twice (one order created), post a near-duplicate (exception raised), move an order through `validated → confirmed → allocated`, and try an illegal jump (rejected).

---

### Sprint 4 (S4) — Bosta adapter, shipments, tracking normalization

**Sprint goal:** an order that reaches `confirmed` gets exactly one Bosta shipment, and its tracking events arrive normalized.

- [ ] **P1-S4-T01** Shipping port: `ShippingCarrier` interface (`quoteRate`, `createShipment`, `cancelShipment`, `getLabel`, `getStatus`, `parseWebhook`, `capabilities`).
  - Deps: P1-S3 complete
  - AC: interface in `packages/integrations`; contract test suite that any adapter must pass (run against the fake courier).

- [ ] **P1-S4-T02** Fake courier server in `fixtures/` (Docker service) that simulates create, status, webhook, timeouts, and 5xx.
  - Deps: T01
  - AC: scripted scenarios: happy path, timeout after create, duplicate create, status flip-flop.

- [ ] **P1-S4-T03** Bosta adapter implementing the port, using the real Bosta API docs. Config: API key per tenant, environment (test/live).
  - Deps: T01, T02
  - AC: contract suite passes against the fake server; adapter never logs the API key; unknown carrier error codes map to internal error types. **Note:** verify real endpoints in Bosta's docs before enabling live; record findings in `docs/decisions/0004-bosta.md`.

- [ ] **P1-S4-T04** Shipments schema and idempotent creation: `shipments` with unique `(order_id, sequence)`; `shipment_requests` log with request/response bodies.
  - Deps: T03
  - AC: calling `createShipment` twice for the same order sequence calls the courier once (verified by fake server request count); timeout after creation recovers by reading existing shipment, not re-creating.

- [ ] **P1-S4-T05** Separate states: `label_created` stored separately from `carrier_accepted`; order `shipped` is set only on `carrier_accepted`.
  - Deps: T04, P1-S3-T02
  - AC: integration test: label created but no courier scan → order remains `label_created`; courier scan → `shipped`.

- [ ] **P1-S4-T06** Tracking normalization: map raw carrier codes to internal statuses (`label_created`, `handed_to_carrier`, `carrier_accepted`, `in_transit`, `arrived_hub`, `out_for_delivery`, `delivered`, `delivery_exception`, `returned_to_sender`, `lost_claim_required`); store every raw event immutably.
  - Deps: T03
  - AC: mapping table is data (JSON per carrier), not code; unknown raw code creates an exception `UNMAPPED_CARRIER_STATUS` instead of failing; `shipment_events` is append-only.

- [ ] **P1-S4-T07** Carrier webhook receiver: verify signature, store raw payload, ACK 200 fast, process via queue; duplicate webhook ignored by `(carrier, event_id)`.
  - Deps: T06, P0-S2-T09
  - AC: replaying the same webhook 10 times produces one event row; invalid signature returns 401 and stores nothing.

- [ ] **P1-S4-T08** Scan-gap and stalled-shipment monitor: job that flags shipments with no event for N hours (configurable per carrier/service).
  - Deps: T06
  - AC: fake clock test flags shipment at N+1 hours, not at N; creates exception `SCAN_GAP`.

**Sprint 4 demo:** confirm an order, see exactly one Bosta shipment on the fake server, push 10 duplicate webhooks, see one shipment event, simulate a timeout and show no double label, then show the scan-gap exception.

---

### Sprint 5 (S5) — Shopify connector, COD basics, tracking page, pilot launch

**Sprint goal:** a pilot brand runs real orders end to end: Shopify → Ops Hub → Bosta → customer tracking page, with COD recorded.

- [ ] **P1-S5-T01** Shopify connector (inbound): OAuth or custom app install, webhook receiver for `orders/create` and `orders/updated`, mapping to internal order via `external_order_id`.
  - Deps: P1-S3-T03
  - AC: fixture payloads from `fixtures/shopify/` map correctly; duplicate webhook produces one order; HMAC verified.

- [ ] **P1-S5-T02** Shopify connector (outbound): push inventory availability per variant and write fulfillment + tracking number back to Shopify when shipped.
  - Deps: T01, P1-S4-T05, P0-S2-T06
  - AC: contract test with recorded responses; failed push retried and surfaces in exceptions after max attempts.

- [ ] **P1-S5-T03** Connector health: `connectors` table with last success, last error, token expiry, error rate; alert when no successful sync in N minutes.
  - Deps: T01
  - AC: expired token creates exception `CONNECTOR_AUTH_FAILED` and pauses that connector's writes.

- [ ] **P1-S5-T04** COD payment record: method `cod`, expected amount, status `pending_collection → collected | failed | returned`.
  - Deps: P1-S3-T01
  - AC: order cannot be marked `paid` for COD until a collection event exists (enforced in domain, tested).

- [ ] **P1-S5-T05** Basic COD settlement import (CSV/XLSX, one courier format for pilot): match lines by tracking number and order reference; unmatched lines go to exception queue.
  - Deps: T04, P1-S4-T04
  - AC: fixture settlement file with 100 lines: correct matched count, unmatched count, and total variance.

- [ ] **P1-S5-T06** Public tracking page: `GET /v1/track?order=&phone=` (rate-limited, phone required) and a minimal branded page in `apps/web/public/track`.
  - Deps: P1-S4-T06
  - AC: wrong phone returns the same generic 404 as unknown order (no enumeration); rate limit tested; Arabic and English labels.

- [ ] **P1-S5-T07** Proactive notifications: templates for `confirmed`, `shipped`, `out_for_delivery`, `delayed`, `delivered`, sent via email (Mailpit in dev) and a WhatsApp adapter stub.
  - Deps: P1-S4-T06
  - AC: each status change produces at most one notification per template (idempotent); templates have AR and EN text.

- [ ] **P1-S5-T08** Ops console v1 (web): login, orders list with filters, order detail with timeline, exception queue, shipment detail.
  - Deps: P0-S1-T07, P1-S3-T07, P1-S4-T04
  - AC: Playwright E2E: login → open exception → assign → resolve; works in RTL Arabic layout.

- [ ] **P1-S5-T09** n8n starter template (JSON) in `docs/automation/`: Shopify → Ops Hub order create → Slack/WhatsApp alert on failure.
  - Deps: P0-S2-T10, P1-S3-T03
  - AC: template imports into n8n without edits except credentials; README explains each node.

- [ ] **P1-S5-T10** Pilot readiness checklist and data migration from the pilot brand's spreadsheet (products, opening stock).
  - Deps: all P1 tasks above
  - AC: checklist in `docs/pilot/checklist.md` fully ticked; dry-run import report reviewed by a human; **Blocker expected:** real brand data and credentials are needed from the business owner.

**Sprint 5 demo / Phase 1 exit:** a real or staging order flows Shopify → Bosta → tracking page; COD settlement file reconciles; an overdue exception fires an alert.

---

## 5. Phase 2 — Reliability & Money

**Goal:** the warehouse, the COD money, and the failure paths are trustworthy enough to scale beyond the pilot.

### Sprint 6 (S6) — Receiving, PO matching, putaway, cycle counts

- [ ] **P2-S6-T01** Receipts: `receipts` and `receipt_lines` against an expected PO (PO model can be a minimal stub here, full in S9); shortage, overage, damage, substitution recorded per line.
  - Deps: P0-S2-T05
  - AC: receiving a line creates movements into `quarantined`, never `on_hand`; discrepancies create exceptions.

- [ ] **P2-S6-T02** Verify and release: moving quarantined units to on_hand requires SKU, quantity, and bin scan (barcode string match).
  - Deps: T01, P0-S2-T03
  - AC: wrong SKU scan rejected; release without bin rejected; release creates a movement with actor and timestamp.

- [ ] **P2-S6-T03** Guided putaway: suggest a bin that already holds the SKU, else nearest free bin in the right zone, respecting capacity.
  - Deps: T02
  - AC: deterministic suggestion (unit tests with fixed bin layout); never suggests a full bin.

- [ ] **P2-S6-T04** Dock-to-stock metric: timestamp from receipt creation to release; exposed in KPIs.
  - Deps: T02
  - AC: metric computed for each receipt; returned by `GET /v1/kpis?metric=dock_to_stock`.

- [ ] **P2-S6-T05** Cycle counts: ABC classification by value and velocity; auto-generated count tasks (A weekly, B monthly, C quarterly) plus triggered counts after large variance.
  - Deps: P0-S2-T08
  - AC: classification unit-tested with a fixed sales fixture; count submit creates `COUNT_VARIANCE` adjustment only after approval.

- [ ] **P2-S6-T06** Warehouse scanner-friendly UI (mobile PWA route): receive, putaway, count, pick.
  - Deps: T02, T05
  - AC: Playwright mobile viewport test completes a receive-and-putaway flow with keyboard barcode input.

**Sprint 6 demo:** receive 50 units with 2 damaged, see 2 exceptions, release 48 to bins, run a cycle count with one variance, approve, see the movement.

---

### Sprint 7 (S7) — COD confirmation, risk scoring, returns and refunds

- [ ] **P2-S7-T01** Confirmation task engine: create a confirmation task for COD orders; channel adapters (WhatsApp template reply, SMS, call task for agent); outcomes `confirmed | changed | cancelled | no_answer`.
  - Deps: P1-S5-T07
  - AC: after N no-answers (configurable), task reassigns to an agent queue; each attempt logged; WhatsApp reply `YES/NO` parsed case-insensitively and in Arabic (`ايوه`, `لا`).

- [ ] **P2-S7-T02** Risk scoring v1: rule-based score from prior refusals/RTOs for phone and address, governorate RTO rate, order value vs history, confirmation outcome, address quality.
  - Deps: P1-S3-T01, P1-S4-T06
  - AC: returns `low | medium | high` plus human-readable reasons; deterministic; unit tests per rule; `GET /v1/orders/{id}/risk-score`.

- [ ] **P2-S7-T03** Risk-based gating: low → auto-dispatch after confirmation; medium → confirmation required; high → hold + exception with suggested prepaid conversion.
  - Deps: T01, T02
  - AC: integration test per tier; tier thresholds stored in tenant settings, not code.

- [ ] **P2-S7-T04** Return request: create from order lines with eligibility check (window, category, final-sale, reason); status flow `requested → approved → label_issued → in_transit_back → received → inspected → dispositioned → closed`.
  - Deps: P1-S3-T02
  - AC: ineligible item rejected with reason code; state machine unit tested.

- [ ] **P2-S7-T05** Return receipt and disposition: receiving a return creates inventory movement per disposition (`restock`, `refurbish`, `outlet`, `liquidate`, `discard`).
  - Deps: T04, P0-S2-T05
  - AC: restock increases on_hand; discard creates a loss movement; each disposition audited.

- [ ] **P2-S7-T06** Refunds with approval gate: refund above tenant threshold requires `refunds:approve` by a different user (four-eyes rule); refund release only after return receipt scan or carrier return-to-origin event.
  - Deps: T04, P0-S1-T08
  - AC: same user cannot approve own refund (tested); refund without return receipt (when required) rejected; approval recorded in audit.

- [ ] **P2-S7-T07** Exchange flow: credit original line, reserve replacement, net the price difference.
  - Deps: T04, P0-S2-T07
  - AC: exchange with replacement out of stock creates exception and does not double-credit.

**Sprint 7 demo:** COD order → confirmation reply YES → risk low → auto-dispatch; high-risk order held; return received, restocked, refund approved by a second user.

---

### Sprint 8 (S8) — Reconciliation, DLQ replay, Posta and J&T adapters

- [ ] **P2-S8-T01** Settlement import v2: multiple courier formats via a parser registry; idempotent by file hash; deductions categorized (delivery_fee, return_fee, cod_commission, storage, other).
  - Deps: P1-S5-T05
  - AC: re-importing the same file creates no duplicates; deduction categories sum to total deduction in tests.

- [ ] **P2-S8-T02** Daily reconciliation job: expected COD vs collected vs remitted per order; unmatched queue; variance report per courier.
  - Deps: T01
  - AC: job runs on a schedule; report produced with totals; variance over threshold creates exception.

- [ ] **P2-S8-T03** Generic reconciler for connectors: pull authoritative list (orders, shipments) in a window, diff against internal, apply rules (import missing, flag conflicts, never overwrite stock from source).
  - Deps: P1-S5-T02
  - AC: deleting an order row in DB then running reconciler restores it from source (integration test with recorded source).

- [ ] **P2-S8-T04** Dead-letter queue: permanent failures stored with payload and error; UI/API to list, replay one, replay batch; replay is idempotent.
  - Deps: P0-S2-T09
  - AC: a poison message lands in DLQ after max attempts; replay after fixing the mapping succeeds exactly once.

- [ ] **P2-S8-T05** Circuit breaker per external system (open after N failures, cool-down, half-open probe).
  - Deps: P1-S4-T03
  - AC: fake courier returning 500 opens the circuit; other couriers unaffected; circuit state visible in connector health.

- [ ] **P2-S8-T06** Posta adapter (same contract suite as Bosta).
  - Deps: P1-S4-T01, P2-S8-T05
  - AC: contract suite green; doc in `docs/decisions/0005-posta.md` with verified endpoints.

- [ ] **P2-S8-T07** J&T Express adapter (same contract suite).
  - Deps: P1-S4-T01, P2-S8-T05
  - AC: contract suite green; doc in `docs/decisions/0006-jt.md`.

- [ ] **P2-S8-T08** Routing v1: pick fulfilment location by availability, then governorate coverage, then cost; pick carrier by governorate coverage, COD support, and historical on-time rate.
  - Deps: P0-S2-T06, P1-S4-T01
  - AC: deterministic routing with unit tests; `GET /v1/routing/preview?order_id=` explains the choice.

**Phase 2 exit:** settlement reconciles daily; DLQ replay works; three couriers pass contract tests; a fault-injection test (kill workers, drop webhooks) loses no orders.

---

## 6. Phase 3 — Growth

**Goal:** buying, supplier accountability, unified customer conversations, and CRM.

### Sprint 9 (S9) — Purchase orders, reorder engine, supplier master

- [ ] **P3-S9-T01** Suppliers: master record with contact, lead time (standard and actual), MOQ, payment terms, documents checklist, backup flag per SKU.
  - Deps: P0 complete
  - AC: CRUD + validation; SKU-supplier mapping with supplier SKU code.

- [ ] **P3-S9-T02** Reorder point engine: `ROP = avg daily demand × lead time + safety stock`; demand uses recency-weighted average (configurable half-life).
  - Deps: P0-S2-T06, T01
  - AC: unit tests with fixed sales series; spike in last 3 days raises demand estimate more than a flat average.

- [ ] **P3-S9-T03** Suggested PO generation grouped by supplier, respecting MOQ, rounded to pack size.
  - Deps: T02
  - AC: `GET /v1/reorder/suggestions` returns draft POs; no suggestion below MOQ.

- [ ] **P3-S9-T04** Purchase orders: lifecycle `draft → pending_approval → sent → acknowledged → confirmed → partially_shipped → shipped → in_transit → arrived → partially_received → received → closed | cancelled | exception`.
  - Deps: T01
  - AC: state machine unit tests; approval required above threshold; immutable PO history.

- [ ] **P3-S9-T05** Supplier acknowledgement tracking: send PO by email with a secure acknowledge link; reminder job after 48 hours.
  - Deps: T04
  - AC: acknowledge link works once; reminder sent once per window; overdue ack creates exception.

- [ ] **P3-S9-T06** Link receipts to PO lines (replaces the stub from P2-S6-T01); over-receipt above tolerance requires approval.
  - Deps: T04, P2-S6-T01
  - AC: receipt line cannot exceed PO line without approval; PO status updates automatically.

**Sprint 9 demo:** low-stock SKU → reorder suggestion → approve → send → acknowledge → receive partially → PO status reflects it.

---

### Sprint 10 (S10) — Supplier scorecards, landed cost, carrier scorecards

- [ ] **P3-S10-T01** Supplier scorecard: acknowledgement time, OTIF, fill rate, quality (damage rate from receipts), cost variance, claim count; rolling 30 days.
  - Deps: P3-S9-T06
  - AC: metrics computed from fixture data match hand-calculated expected values.

- [ ] **P3-S10-T02** Landed cost: allocate PO cost + freight + duties + surcharges to received units (by value or weight, configurable).
  - Deps: P3-S9-T06
  - AC: allocated costs sum exactly to total (rounding remainder assigned deterministically); unit test with odd amounts.

- [ ] **P3-S10-T03** Carrier scorecard by carrier, governorate, service: on-time rate, first-attempt rate, exception rate, cost per shipment, claims.
  - Deps: P1-S4-T06, P2-S8-T08
  - AC: scorecard reproduces fixture expectations; threshold breach creates exception `CARRIER_SLA_BREACH`.

- [ ] **P3-S10-T04** Invoice reconciliation for carrier invoices: compare quoted vs invoiced rate per shipment; flag surcharges not in rate card.
  - Deps: P2-S8-T01
  - AC: invoice fixture with 2 surcharge mismatches → exactly 2 flagged lines.

- [ ] **P3-S10-T05** Claims workflow: lost/damaged/false-delivered cases with evidence attachments and carrier claim status.
  - Deps: P2-S8-T05
  - AC: claim cannot close without evidence or explicit waiver (audited).

**Sprint 10 demo:** show supplier scorecard for a supplier with a late delivery, landed cost for a PO with duties, and a carrier breach alert.

---

### Sprint 11 (S11) — Unified inbox, WhatsApp, tickets, macros

- [ ] **P3-S11-T01** Ticket model: `tickets` linked to customer, order, shipment, payment, return; types, priority, status, owner, SLA due.
  - Deps: P1-S3-T01
  - AC: ticket cannot be created without customer or an explicit "unknown" flag; priority derived from type + SLA table.

- [ ] **P3-S11-T02** Channel ingestion: WhatsApp Business API connector (inbound messages, outbound templates), with conversation threading by normalized phone.
  - Deps: T01
  - AC: inbound message creates or appends to ticket; template send respects 24-hour window rule (tested with fixed clock).

- [ ] **P3-S11-T03** Instagram/Facebook and email connectors (inbound at minimum).
  - Deps: T01
  - AC: messages from fixtures link to the correct customer; attachment size limit enforced.

- [ ] **P3-S11-T04** WISMO auto-reply: detect "where is my order" intent (AR + EN keyword rules v1), fetch live tracking, reply with status and link; escalate if delayed.
  - Deps: P1-S4-T06, T02
  - AC: intent test set of 30 messages with expected labels reaches agreed precision threshold (defined in test file).

- [ ] **P3-S11-T05** Agent console: order and shipment sidebar, controlled actions (cancel before dispatch, edit address before dispatch, resend, refund via approval flow), internal notes vs customer messages.
  - Deps: T01, P2-S7-T06
  - AC: actions create audit entries; refund action routes to approval; internal notes never sent to customer (tested).

- [ ] **P3-S11-T06** Macros in AR and EN with variables.
  - Deps: T05
  - AC: rendered macro never leaves an unfilled variable (test fails on missing variable).

- [ ] **P3-S11-T07** Priority and SLA queues: critical/high/normal/low with targets; overdue tickets escalate.
  - Deps: T01
  - AC: fake clock test escalates on time.

**Sprint 11 demo:** WhatsApp "فين طلبي؟" → auto-reply with live status; an agent refunds through approval; internal note stays internal.

---

### Sprint 12 (S12) — CRM, segments, automations, KPI dashboards

- [ ] **P3-S12-T01** Customer profile: unified timeline (orders, tickets, returns, refunds, COD history, consent flags); identity merge suggestions (human confirms).
  - Deps: P3-S11-T01
  - AC: merge requires explicit confirm and writes audit; profile is tenant-isolated.

- [ ] **P3-S12-T02** Consent ledger per channel and purpose with timestamp and source.
  - Deps: T01
  - AC: marketing message to a customer without marketing consent is blocked (tested).

- [ ] **P3-S12-T03** Dynamic segments: VIP, repeat, first-time, at-risk, dormant, open-issue, high-RTO-risk; membership updates from events.
  - Deps: T01
  - AC: order event moves customer from first-time to repeat within one job cycle (test).

- [ ] **P3-S12-T04** Automations engine v1: trigger (event) → conditions → actions (send message, create task, create exception); suppression rules (open ticket, open refund, delivery exception, frequency cap, quiet hours).
  - Deps: T02, T03
  - AC: suppression rules each have a test that proves a message is blocked; frequency cap verified over 7 days (fake clock).

- [ ] **P3-S12-T05** Starter automations: abandoned cart, post-delivery follow-up, reorder reminder, win-back.
  - Deps: T04
  - AC: each automation has a fixture-driven test and a disable switch per tenant.

- [ ] **P3-S12-T06** KPI service and dashboards: orders (cycle time, SLA), inventory (accuracy, oversells, dock-to-stock), shipping (on-time, scan-gap, WISMO), COD (collection rate, unmatched amount), support (first response, resolution), CRM (repeat rate, unsubscribe).
  - Deps: all P1–P3 metric sources
  - AC: each KPI has a documented formula in `docs/kpis.md` and a test with fixture data.

- [ ] **P3-S12-T07** Threshold alerts: oversell > 0, scan-gap count > N, unmatched COD > X EGP, RTO rate per governorate > Y%; delivered via email and WhatsApp.
  - Deps: T06
  - AC: alert fires once per breach window (no spam); alert thresholds stored per tenant.

**Phase 3 exit:** pilot brand uses POs, inbox, and dashboards daily; no critical manual spreadsheet remains for stock or COD.

---

## 7. Phase 4 — Intelligence & Ecosystem

**Goal:** AI agents and automation tools can run the business safely through the API and MCP.

### Sprint 13 (S13) — Public API hardening, sandbox, docs

- [ ] **P4-S13-T01** API key scopes review: full scope catalog in `docs/api/scopes.md`; every route declares its required scope (CI check).
  - Deps: P0-S1-T09
  - AC: CI fails if a route has no scope declaration.

- [ ] **P4-S13-T02** Rate limits per key and per tenant with `X-RateLimit-*` and `Retry-After` headers.
  - Deps: P0-S1-T09
  - AC: test exceeds limit and receives 429 with correct headers.

- [ ] **P4-S13-T03** Cursor pagination, filtering and sorting standard applied to all list endpoints.
  - Deps: all list routes
  - AC: contract test for every list route (cursor round-trip, invalid cursor 400).

- [ ] **P4-S13-T04** Agent safety controls: dry-run flag on write endpoints, approval gate for actions above thresholds (returns `202` with approval request), volume caps per key per hour, kill switch.
  - Deps: P2-S7-T06
  - AC: dry-run returns diff and writes nothing; over-threshold action returns 202 and does not execute until approved; kill switch blocks key within one request.

- [ ] **P4-S13-T05** Sandbox environment: separate tenant with fake couriers and fake storefront; resettable via `POST /v1/sandbox/reset`.
  - Deps: P1-S4-T02
  - AC: reset returns sandbox to fixture state in under 30 seconds.

- [ ] **P4-S13-T06** Developer docs site generated from OpenAPI, with examples in curl, JavaScript, and Python, plus webhook signature verification sample.
  - Deps: P0-S2-T11
  - AC: docs build in CI; examples executed as tests against sandbox.

- [ ] **P4-S13-T07** Machine-readable enums and geo endpoints for agents: `GET /v1/meta/enums`, `GET /v1/geo/governorates`, `GET /v1/geo/districts`.
  - Deps: P0-S2-T04
  - AC: enum list is identical to the validation source (test compares both).

**Sprint 13 demo:** an external script uses a scoped key, hits a rate limit, runs a dry-run, and passes an approval gate in the sandbox.

---

### Sprint 14 (S14) — MCP server for Claude and other agents

- [ ] **P4-S14-T01** `apps/mcp` MCP server exposing curated tools: `search_orders`, `get_order`, `get_inventory_availability`, `list_exceptions`, `resolve_exception`, `get_shipment_status`, `draft_customer_reply`, `generate_daily_report`.
  - Deps: S13 complete
  - AC: each tool has a JSON schema, description, and a test that calls it against sandbox.

- [ ] **P4-S14-T02** Write tools are gated: `create_shipment`, `refund`, `cancel_order` require approval mode unless the key has explicit auto-approve scope.
  - Deps: T01, P4-S13-T04
  - AC: test shows a write without approval returns pending approval; no side effect occurs before approval.

- [ ] **P4-S14-T03** Connect Claude Desktop/Code to the MCP server with a setup guide in `docs/agents/claude.md`.
  - Deps: T01
  - AC: guide steps verified on a clean machine; screenshots are optional, commands are not.

- [ ] **P4-S14-T04** Redaction for agent responses: mask phone and address unless scope `pii:read`.
  - Deps: T01
  - AC: tool output for a key without `pii:read` contains no full phone number (regex test).

**Sprint 14 demo:** from Claude, ask "which orders are stuck today?", get the exception list, resolve one with approval.

---

### Sprint 15 (S15) — Agent playbooks, automation templates, accounting export

- [ ] **P4-S15-T01** Playbook: morning report (yesterday's orders, COD collected, shipments, RTO, open exceptions) sent to WhatsApp/Telegram/email.
  - Deps: S14, P3-S12-T06
  - AC: playbook runs on schedule in sandbox; output matches KPI values for the same fixture.

- [ ] **P4-S15-T02** Playbook: exception triage (group by reason, suggest next action, draft messages for approval).
  - Deps: S14
  - AC: suggestions never execute writes; drafts stored as pending.

- [ ] **P4-S15-T03** Playbook: COD settlement analysis from an uploaded file (matched/unmatched totals, top candidate orders).
  - Deps: P2-S8-T01
  - AC: result matches reconciliation report for the same file.

- [ ] **P4-S15-T04** n8n templates: Shopify order → Ops Hub, Ops Hub confirmed order → Bosta shipment, tracking → WhatsApp, low stock → PO draft, daily report, COD email attachment → settlement import, overdue exception → escalation.
  - Deps: S13
  - AC: each template imports cleanly into n8n; each has a README and a sandbox run log.

- [ ] **P4-S15-T05** Make.com blueprints for the same 7 flows.
  - Deps: P4-S15-T04
  - AC: blueprints import in Make.com; each has a README.

- [ ] **P4-S15-T06** Accounting export: daily sales, COD settlements, refunds, and PO costs as CSV with a configurable chart-of-accounts mapping.
  - Deps: P2-S8-T02, P3-S10-T02
  - AC: totals in export equal totals in KPI service for the same period (test).

- [ ] **P4-S15-T07** Full end-to-end regression suite (Playwright + API) covering the top 10 business flows, run nightly.
  - Deps: all
  - AC: suite green on main; flaky tests quarantined with an owner and a deadline.

**Phase 4 exit:** an external agent can run the morning report and triage exceptions through MCP with approvals, and an n8n flow can create orders and shipments with no manual steps.

---

## 8. Cross-cutting tracks (run alongside sprints, not in sequence)

These are small recurring tasks. Pick them up when a sprint has spare capacity or before each phase exit.

- [ ] **X-01** Security review of auth, RBAC, RLS, and API keys (before P1 pilot).
- [ ] **X-02** Load test: 50 orders per minute and 500 webhooks per minute, p95 latency target set in `docs/perf.md` (before P1 pilot and before P3).
- [ ] **X-03** Backup and restore drill: restore latest backup to a fresh database and run the smoke suite (before P1 pilot, then monthly).
- [ ] **X-04** Personal data policy: retention per data type, export and deletion request flow, consent wording reviewed by a local legal advisor (before pilot).
- [ ] **X-05** Arabic copy review by a native speaker for every user-facing template (before each phase exit).
- [ ] **X-06** Observability dashboards: queue depth, webhook lag, error rate, DLQ size, connector health (from P1).
- [ ] **X-07** ADRs: write an ADR in `docs/decisions/` for every deviation from Section 1 (tech baseline).

---

## 9. Definition of Done (task level)

A task is `[x]` only when all are true:

1. Acceptance criteria verified (automated test where possible, otherwise a documented manual check with output pasted in the progress log).
2. Lint, typecheck, and tests pass locally and in CI.
3. Migrations are included and reversible in dev.
4. New endpoints are in OpenAPI and have a scope declared.
5. New mutating paths write audit entries and events via the outbox.
6. No secrets, real customer data, or `.env` files committed.
7. Progress log updated.

## 10. Definition of Done (sprint level)

- All sprint tasks are `[x]` or `[!]` with a blocker that a human has acknowledged.
- Sprint demo runs end to end on the staging environment.
- No open P0 or P1 bugs introduced by the sprint.
- Retro notes added to the progress log (what slowed us down, what to change).

## 11. Definition of Done (phase level)

- Phase exit checks listed in Section 4–7 are all satisfied.
- Relevant cross-cutting tracks (Section 8) for that phase are `[x]`.

---

## 12. Dependencies between phases (summary)

```
P0 Foundation ──► P1 Core Ops MVP ──► P2 Reliability & Money ──► P3 Growth ──► P4 Intelligence
   │                  │                         │                    │
   │                  └─ pilot brand live ◄─────┘ (P2 before scale)   └─ P4 MCP needs P2 approval gates
   └─ API keys + OpenAPI needed by P1 n8n template (S5) and P4 agents
```

---

## 13. Risks and mitigations

| Risk | Impact | Mitigation | Task |
|---|---|---|---|
| Courier APIs differ from assumptions | Adapter rework | Verify endpoints in S4 before coding; contract suite | P1-S4-T03, P0 decision docs |
| COD settlement formats change | Reconciliation breaks | Parser registry + fixtures + variance alerts | P2-S8-T01 |
| Webhook loss during outage | Missing orders | Outbox + reconciler | P2-S8-T03 |
| Agent writes wrong data | Financial or stock damage | Approval gate, dry-run, kill switch | P4-S13-T04 |
| Tenant data leak | Trust loss, legal exposure | RLS + isolation tests in CI | P0-S1-T04 |
| Scope creep | Late pilot | Backlog section, one task at a time | Section 0 rule 5 |
| Real brand data is messy | Import failures | Dry-run import and human review | P1-S5-T10 |
| Legal/privacy requirements (Egypt) | Launch blocked | Early legal review | X-04 |

---

## 14. Backlog (not in scope; do not implement without a new task)

- Multi-warehouse transfer optimization with cost model
- Native mobile app (PWA covers Phase 2–3)
- Marketplace connectors (Amazon, Noon) beyond the Phase 3 list
- Full double-entry accounting (accounting export only in P4)
- Predictive demand forecasting with ML (P3 uses recency-weighted average)
- Customer self-service returns portal (basic flow only in P2)

---

## 15. Progress log

Format: `YYYY-MM-DD · TASK-ID · summary · commit`

- 2026-11-10 · P0-S1-T01 · pnpm workspace scaffolded in `ops-hub/`; `pnpm install`, `lint`, `typecheck`, `test` all green · commit 56622da
- 2026-11-10 · P0-S1-T02 · compose services postgres 16.15, redis 7, mailpit healthy; `pnpm db:ping` connected · commit caece27
- 2026-11-10 · P0-S1-T03 · Drizzle schema + migrations; 4 tables applied, audit_log INSERT/SELECT only, reset→migrate verified · commit 2347dfa
- 2026-11-10 · P0-S1-T04 · RLS on tenants/memberships/audit_log, withTenant transaction scope, isolation test green · commit 0de7b3e
- 2026-11-10 · P0-S1-T05 · Money/phone/clock/errors/i18n with 20 TDD tests; invalid phone and float money rejected · commit 9cd887f
- 2026-11-10 · P0-S1-T06 · Fastify app with request ids, RFC 7807 errors, redaction; 7 HTTP tests incl. canary log check · commit 341f798
- 2026-11-10 · P0-S1-T07 · argon2id + Redis sessions; generic auth errors, expiry and 5/15min rate limit verified; 49 tests green · commit 9e7501a
- 2026-11-10 · P0-S1-T08 · RBAC matrix + requirePermission guard; role allow/deny and 401/403 route tests · commit 130eedb
- 2026-11-11 · P0-S1-T09 · API keys with SHA-256 hash at rest, scopes, IP allow-list, revoke, last_used_at; 14 unit + 6 DB integration tests green; live smoke of all AC flows · commit 9d9b7c2
- 2026-11-11 · P0-S1-T10 · audit writer + GET /v1/audit reader; api-key and login mutations audited; coverage enforcement test, 4 audit + 6 api-key DB integration tests green; live smoke verified · commit 374262b
- 2026-11-11 · P0-S1-T11 · Ops Hub CI workflow committed (service containers, drift dry-run, RUN_DB_TESTS suite); every step executed locally green incl. the drift fail branch; blocked on GitHub push because origin is diverged (23 ahead / 379 behind) · commit d7aae90

---

## 16. Changelog of this roadmap

- v1.0 — initial roadmap created from `ecommerce-ops-system-architecture.md`.
