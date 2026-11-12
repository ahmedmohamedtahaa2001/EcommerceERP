# API scopes

Every non-public route declares the scope it needs. The declaration lives in
`packages/contracts/src/openapi.ts` and is published as `x-required-scope` in
the OpenAPI document; `apps/api/tests/openapi.test.ts` fails the build when a
route has no scope or when the registry and the running app disagree.

Scopes are the permissions in `packages/domain/src/rbac.ts`:

| Scope                                | What it unlocks                                         |
| ------------------------------------ | ------------------------------------------------------- |
| `products:read` / `products:write`   | Catalog: products, variants, imports                    |
| `orders:read` / `orders:write`       | Orders, exceptions, shipments, tickets, COD tasks       |
| `inventory:read` / `inventory:write` | Locations, bins, stock, receipts, cycle counts          |
| `shipments:read` / `shipments:write` | Shipment operations (currently read-only routes)        |
| `refunds:read` / `refunds:approve`   | Refunds; `refunds:approve` is the four-eyes gate        |
| `customers:read` / `customers:write` | Customer profiles, consent, segments                    |
| `reports:read`                       | KPIs, scorecards, settlement, reconciliation, playbooks |
| `audit:read`                         | The audit log                                           |
| `users:read` / `users:write`         | Staff accounts and memberships                          |
| `api_keys:read` / `api_keys:write`   | API keys                                                |
| `settings:write`                     | Connectors, webhooks, automations, DLQ, sandbox, safety |

## Public routes

These need no authentication:

- `GET /healthz`, `GET /readyz`
- `GET /v1/openapi.json`, `GET /docs`
- `POST /v1/auth/login`
- `GET /v1/track` (requires the order number **and** the customer phone)
- `POST /v1/webhooks/carriers/:carrier`, `POST /v1/webhooks/shopify/orders`
  (authenticated by signature, not by scope)

## Agent scopes

The MCP server adds one convention on top of the RBAC scopes: a write tool
needs `auto_approve:<scope>` before it may run. Without it the tool returns a
pending-approval result and performs no write.

Agent keys also need `pii:read` to see unmasked phone numbers and addresses;
without it those values are redacted in tool output.
