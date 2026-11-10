# Ops Hub

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

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `pnpm lint`        | ESLint over every workspace package           |
| `pnpm typecheck`   | `tsc --noEmit` over every workspace package   |
| `pnpm test`        | Vitest across the workspace                   |
| `pnpm build`       | Runs each package's `build` script when it has one |

All three of `lint`, `typecheck`, and `test` must pass before a task is
committed, per the roadmap's global non-negotiables.

If pnpm is not installed globally, prefix commands with `npx pnpm@10`
(for example `npx pnpm@10 install`).
