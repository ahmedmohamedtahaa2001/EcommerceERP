# Load test (X-02)

Target per `ROADMAP.md` Section 8, X-02: sustain 50 orders/minute and 500
webhooks/minute with a documented p95 latency target, before P1 pilot and
before P3.

## p95 latency targets

| Path                                  | p95 target |
| ------------------------------------- | ---------- |
| `POST /v1/orders`                     | 300 ms     |
| `POST /v1/webhooks/carriers/:carrier` | 100 ms     |

These are the targets this test is measured against, not aspirational
numbers — pick in advance because the order path does a validated write
(customer upsert, address resolve, order create, duplicate-detection scan,
idempotency hash check) while the webhook path is a stateless parse plus an
in-memory dedup check.

## How it was run

A real HTTP load generator (no mocks) drove the live `apps/api` server
(`pnpm start`, port 3001) against the dev Postgres/Redis stack
(`ops-hub-postgres-1` / `ops-hub-redis-1`), seeded with the standard demo
tenant (`pnpm db:seed`) plus one API key with full scopes.

Script: see the commit that introduces this doc for the generator (kept in
the session scratch space, not committed, since it's a one-off harness, not
a maintained test). Two independent request streams ran concurrently for
60 seconds:

- `order` stream: one `POST /v1/orders` every 1200 ms (50/min), with a fresh
  `Idempotency-Key` and a distinct phone per request.
- `webhook` stream: one `POST /v1/webhooks/carriers/bosta` every 120 ms
  (500/min), with a fresh `eventId` per request.

Each request's wall-clock latency (`fetch` start to body-read-complete) and
HTTP status were recorded; p50/p95/p99 computed from the sorted sample.

## Finding fixed before the test could run

`POST /v1/webhooks/carriers/:carrier` (`apps/api/src/shipments/webhook-routes.ts`)
was never registered in `app.ts`/`wiring.ts` — the route 404'd on every real
deployment despite the handler existing. Fixed in the commit right before
this one (`fix(shipments): wire the carrier webhook receiver into the
running app`) by adding a `carriers` map (bosta/posta/jt `HttpCarrierAdapter`
instances) to `wiring.ts` and registering the route whenever shipments and
carriers are both configured. Full suite re-run after the fix: 374/374
passing, lint and typecheck clean.

## Results — 2026-11-12

60-second run, dev machine, local Docker Postgres/Redis, single API process,
no connection pooling tuned beyond defaults.

| Stream   | Count | Errors | p50     | p95     | p99     | Max     | p95 target | Pass |
| -------- | ----- | ------ | ------- | ------- | ------- | ------- | ---------- | ---- |
| orders   | 50    | 0      | 36.1 ms | 47.5 ms | 53.7 ms | 53.7 ms | 300 ms     | ✅   |
| webhooks | 493   | 0      | 4.5 ms  | 6.0 ms  | 7.5 ms  | 12.8 ms | 100 ms     | ✅   |

(493 vs. the nominal 500/min webhook count is the loop's own fixed-interval
scheduling overhead over the 60s window, not dropped/failed requests — every
request issued got a 200.)

Zero errors on both streams. Both p95s land well inside target, on a single
unoptimized dev instance — there is substantial headroom before this becomes
a real bottleneck.

## Caveats

- This is a single-process, single-machine dev-stack result, not a
  production-topology test (no load balancer, no connection pool sizing
  pass, no concurrent-tenant contention).
- The order stream's duplicate-detection check flags most of these requests
  as `DUPLICATE_SUSPECTED` (same SKU set within 24h, by design for the load
  test's repeated payload) — this does not block order creation and is
  reflected in the measured latency, not hidden from it.
- No sustained/soak run (hours) was done — this is a point-in-time check at
  the target rate, matching X-02's "before P1 pilot" scope. A longer soak
  should be run before P3, per the roadmap's own reopened note.
