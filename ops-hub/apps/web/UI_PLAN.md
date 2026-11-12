# Ops Hub Web Console — UI Plan & Design Contract

> Locked contract for all agents working on `apps/web`. Read fully before writing code.
> Visual language: **Flora.ds** (Grupo Boticário design system, see `design.md` at repo root).
> Engineering rules: **Skills/frontend-ui-engineering/SKILL.md**. Cinematic touches: **Skills/epic-design/** (login only).

## 1. Stack (locked)

- React 18 + TypeScript + Vite 6, `react-router-dom` v7, `@tanstack/react-query` v5
- Tailwind CSS **3.4** (config-driven tokens, no Tailwind v4 CSS-first syntax)
- Fonts: **Nunito Sans** (Latin, 400/600/700/800) + **Cairo** (Arabic) via Google Fonts `<link>` in `index.html`
- State: TanStack Query for all server state; `useState` locally; URL search params for filters/pagination; no Redux/Zustand
- Auth: bearer token from `POST /v1/auth/login` (`{ token, user }`), stored in `localStorage` (`ops-hub.session`), sent as `Authorization: Bearer …`; `GET /v1/auth/me` on boot; 401 → clear + redirect `/login`

## 2. Design tokens (Flora.ds → Tailwind, locked)

Colors (CSS variables in `styles/globals.css`, mirrored in `tailwind.config.ts` under `theme.extend.colors`):

| Token                                                                                                                                                                     | Value                                                                                                                                                           | Use                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `primary`                                                                                                                                                                 | `#006B3F`                                                                                                                                                       | CTAs, active nav, primary buttons        |
| `primary.light` `#1A8A5C` · `.lightest` `#E6F5EF` · `.dark` `#004D2D` · `.darkest` `#003520`                                                                              | hover states, subtle bg, sidebar bg                                                                                                                             |
| `secondary`                                                                                                                                                               | `#C5A34D` (light `#D4B86E`, lightest `#F5EDDA`, dark `#A6873D`, darkest `#7A632D`)                                                                              | premium accents, badges — never warnings |
| `bg`                                                                                                                                                                      | `#FAFAF8` (warm)                                                                                                                                                | app background — never cold gray/white   |
| `surface`                                                                                                                                                                 | `#FFFFFF`                                                                                                                                                       | cards, panels, modals                    |
| `ink`                                                                                                                                                                     | `#1A1A1A` (900) / `#2D2D2D` (800) / `#4A4A4A` (700) / `#6B6B6B` (600) / `#9E9E9C` (500) / `#BDBDBB` (400) / `#E0E0DE` (300) / `#EEEEEC` (200) / `#F5F5F3` (100) | text hierarchy & borders                 |
| `success` `#2E7D32` / `+light` `#C8E6C9` · `warning` `#F9A825` / `+light` `#FFF9C4` · `alert` `#C62828` / `+light` `#FFCDD2` · `info/link` `#1565C0` / `+light` `#BBDEFB` | status colors (always paired with icon/text, never color alone)                                                                                                 |

Other tokens:

- **Radius**: default `8px` (`rounded-lg` mapped to 8px); `4px` inputs/tags, `12px` feature cards, `16px` hero cards, `999px` pills
- **Spacing**: 4-based scale only (4/8/12/16/24/32/48/64/80) — no arbitrary values
- **Shadows**: subtle only — `sm` for resting cards, `md` for dropdowns, `lg` modals; never heavier than `lg`
- **Type scale**: 12 caption / 14 body2 / 16 body1 / 18 / 20 / 22 / 24 / 28 / 32; weights 400/600/700/800; headings tight (1.2), body 1.5
- **Container**: max-w 1280px content, 1440px wide

## 3. Directionality & i18n (locked)

- Default locale **`ar`**, `dir="rtl"`; toggle to `en` (LTR) in the topbar; `document.documentElement.dir` updates on change
- All user-facing strings are keys in `src/lib/i18n/{ar,en}.ts` — **no hardcoded strings in components**
- Any line in JSX that starts with an English word while locale is `ar` must still render correctly under RTL (bidi isolation where needed)
- Numbers/dates: `Intl.NumberFormat('ar-EG' | 'en-EG')` via `lib/format` helpers

## 4. Domain formatting rules (locked)

- **Money**: integer minor units (piastres) → `formatMoney(minor, currency="EGP")` → `1,234.56 ج.م` / `EGP 1,234.56`. Never floats.
- **Phone**: display E.164 as-is; search accepts raw input (server normalizes)
- **Dates/times**: local format via `Intl.DateTimeFormat`, relative ("قبل ٣ ساعات" / "3h ago") for timelines
- **Order status pills**: single `StatusPill` component mapping the 12-state machine (`pending, validated, confirmed, allocated, on_hold, picking?, label_created, carrier_accepted, shipped, delivered, cancelled, returned`) to Flora feedback colors + icon + label. Unknown status renders neutral gray — never crashes.

## 5. Component kit (`src/components/ui/`) — build these, use these

`Button` (contained primary/secondary, outlined, ghost, text; sizes sm/md; loading + disabled states), `IconButton`, `Input`, `Select`, `Checkbox`, `SearchBar`, `Card`, `Badge`, `Tag`, `StatusPill`, `Table` (sortable headers, sticky header, zebra with `neutral-100`, density comfortable), `DataTable` wrapper with TanStack Query + pagination + filters, `Tabs`, `Pagination`, `Modal`, `Drawer`, `Toast` (provider + `useToast`), `Skeleton`, `EmptyState`, `ErrorState` (with retry), `Avatar` (initials fallback), `Tooltip`-lite, `Timeline` (order events), `ProgressBar`, `Breadcrumbs`, `PageHeader`, `StatCard` (KPI), `ConfirmDialog` (destructive actions).

Every list/table page must implement: **loading skeleton → error with retry → empty with guidance → data**. Keyboard accessible; visible focus rings (`primary` 2px); touch targets ≥44px.

## 6. App shell (`src/layout/`)

- **Sidebar** (dark `#003520`, right side in RTL): Flora leaf logo mark (inline SVG), nav sections — العمليات (Dashboard, Orders, Exceptions), المخزون (Availability, Movements, Adjustments, Reservations, Locations), الكتالوج (Products, Import), العملاء, التحليلات, الإدارة (Audit Log, API Keys, Settings, Agents). Active item: `primary.lightest`-on-dark pill with gold left/right indicator bar. Collapsed icon-only mode on md.
- **Topbar**: search (orders/products/phone), locale toggle AR/EN, notifications (exceptions count from API), user avatar menu (logout).
- **Content**: warm `#FAFAF8`, `max-w` 1280, `Breadcrumbs` + `PageHeader` on every page.

## 7. Routes (locked — agents fill page files only)

```
/login                         LoginPage (epic-design cinematic)
/                              DashboardPage
/orders  /orders/:orderId      OrdersPage, OrderDetailPage
/exceptions                    ExceptionsPage
/products /products/:productId /products/import   ProductsPage, ProductDetailPage, ProductImportPage
/inventory/availability        AvailabilityPage
/inventory/movements           MovementsPage
/inventory/adjustments         AdjustmentsPage
/inventory/reservations        ReservationsPage
/inventory/locations           LocationsPage
/customers                     CustomersPage (v1: list + profile drawer)
/analytics                     AnalyticsPage
/audit                         AuditLogPage
/api-keys                      ApiKeysPage
/settings                      SettingsPage (users/roles/profile)
/agents                        AgentsPage (automation stub)
*                              NotFoundPage
```

`app/router.tsx` contains the complete table on day one; page agents must keep file names/paths exactly as above.

## 8. API surface (real endpoints to wire)

Base `VITE_API_URL` (default `http://localhost:3001`), all under `/v1`:

- `POST /auth/login {email,password}` → `{token,user}`; `POST /auth/logout`; `GET /auth/me`
- `GET|POST /products`, `GET /products/:id`, `PATCH /products/:id`; `GET /products/:productId/variants`, `POST /products/:productId/variants`, `PATCH /variants/:id`; `POST /products/import {format,content,dryRun}` (dry-run report UI)
- `POST|GET /locations`, `GET /locations/:id`, `DELETE /locations/:id`; `POST /locations/:locationId/bins`, `GET /locations/:locationId/bins`
- `POST /stock/movements` (adjustments via `/stock/adjustments {variantId,locationId,quantity,reason}`), `GET /stock/movements?variantId&locationId`, `GET /stock/balances?sku&location`
- `GET /inventory/availability?sku&location`
- `POST /stock/reservations`, `POST /stock/reservations/:id/release`
- `POST /orders` (requires `Idempotency-Key` header), `GET /orders?status&…`, `GET /orders/:id`, `POST /orders/:id/validate {locationId}`
- `GET /order-exceptions?status`, `GET /order-exceptions/:id`, `POST /order-exceptions/:id/assign`, `POST /order-exceptions/:id/resolve`
- `GET /audit?object&…`
- `POST /api-keys` (secret shown once — one-time reveal UI), `GET /api-keys`, `DELETE /api-keys/:id`
- `GET /meta/enums` (adjustmentReasons, stockBuckets), `GET /geo/governorates`, `GET /geo/districts`

Error responses are RFC 7807 problem JSON — `ErrorState` renders `title`/`detail`. Add per-domain typed helpers in `lib/api/*.ts`.

## 9. Epic-design application (login only)

LoginPage: full-viewport split — dark `#003520` cinematic panel (depth-0 gradient atmosphere, depth-1 gold/green glow blobs, floating depth-2 decorative shapes, depth-3 brand mark, depth-4 headline with staggered text reveal) + depth-4 login form card. Floating loop 6–14s on decorative elements; `prefers-reduced-motion` fallback mandatory; `pointer: coarse` → reduced effects; decorative elements `aria-hidden="true"`. App pages get **no** parallax — density and speed win inside an ops console.

## 10. Quality bar (from frontend-ui-engineering)

- No AI aesthetic: no purple, no decorative gradients (Flora greens only), no `rounded-2xl` everywhere, no lorem ipsum — use realistic Arabic/English demo content
- Components ≤200 lines; colocate hooks; container/presentation split for data pages
- WCAG AA contrast; don't rely on color alone; keyboard-navigable everything
- `npm run check` equivalent for web: `pnpm --filter @ops-hub/web lint && typecheck && build && test`
