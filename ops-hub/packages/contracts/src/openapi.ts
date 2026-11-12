import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

/**
 * The single registry of every HTTP route Ops Hub exposes. The OpenAPI 3.1
 * document is generated from it, and a test asserts that every route the
 * Fastify app actually registers appears here (and therefore in the spec).
 */

export interface RouteDefinition {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  summary: string;
  tag: string;
  /** Zod schema for the JSON request body, when the route takes one. */
  body?: ZodTypeAny;
  /** Zod schema for the query string, when the route reads one. */
  query?: ZodTypeAny;
  /** Zod schema for the success response body. */
  response?: ZodTypeAny;
  /** Public route (no auth required). */
  public?: boolean;
  /** Required API-key scope, when the route is scope-guarded. */
  scope?: string;
}

export const ROUTE_REGISTRY: RouteDefinition[] = [
  // Health & docs
  {
    method: "get",
    path: "/healthz",
    summary: "Liveness probe",
    tag: "Health",
    public: true,
  },
  {
    method: "get",
    path: "/readyz",
    summary: "Readiness probe",
    tag: "Health",
    public: true,
  },
  {
    method: "get",
    path: "/v1/openapi.json",
    summary: "OpenAPI 3.1 document",
    tag: "Health",
    public: true,
  },
  {
    method: "get",
    path: "/docs",
    summary: "API documentation page",
    tag: "Health",
    public: true,
  },

  // Auth
  {
    method: "post",
    path: "/v1/auth/login",
    summary: "Staff login",
    tag: "Auth",
    public: true,
  },
  {
    method: "post",
    path: "/v1/auth/logout",
    summary: "Log out",
    tag: "Auth",
    scope: "users:read",
  },
  {
    method: "get",
    path: "/v1/auth/me",
    summary: "Current session",
    tag: "Auth",
    scope: "users:read",
  },

  // API keys
  {
    method: "post",
    path: "/v1/api-keys",
    summary: "Create an API key",
    tag: "API keys",
    scope: "api_keys:write",
  },
  {
    method: "get",
    path: "/v1/api-keys",
    summary: "List API keys",
    tag: "API keys",
    scope: "api_keys:read",
  },
  {
    method: "delete",
    path: "/v1/api-keys/:id",
    summary: "Revoke an API key",
    tag: "API keys",
    scope: "api_keys:write",
  },

  // Audit
  {
    method: "get",
    path: "/v1/audit",
    summary: "Read the audit log",
    tag: "Audit",
    scope: "audit:read",
  },

  // Geo
  {
    method: "get",
    path: "/v1/geo/governorates",
    summary: "List governorates",
    tag: "Geo",
    scope: "orders:read",
  },
  {
    method: "get",
    path: "/v1/geo/districts",
    summary: "List districts",
    tag: "Geo",
    scope: "orders:read",
  },

  // Meta
  {
    method: "get",
    path: "/v1/meta/enums",
    summary: "Machine-readable enums",
    tag: "Meta",
    scope: "orders:read",
  },

  // Catalog
  {
    method: "post",
    path: "/v1/products",
    summary: "Create a product",
    tag: "Catalog",
    scope: "products:write",
  },
  {
    method: "get",
    path: "/v1/products",
    summary: "List products",
    tag: "Catalog",
    scope: "products:read",
  },
  {
    method: "get",
    path: "/v1/products/:id",
    summary: "Read a product",
    tag: "Catalog",
    scope: "products:read",
  },
  {
    method: "patch",
    path: "/v1/products/:id",
    summary: "Update a product",
    tag: "Catalog",
    scope: "products:write",
  },
  {
    method: "post",
    path: "/v1/products/import",
    summary: "Bulk import products",
    tag: "Catalog",
    scope: "products:write",
  },
  {
    method: "get",
    path: "/v1/products/:productId/variants",
    summary: "List variants of a product",
    tag: "Catalog",
    scope: "products:read",
  },
  {
    method: "post",
    path: "/v1/variants",
    summary: "Create a variant",
    tag: "Catalog",
    scope: "products:write",
  },
  {
    method: "get",
    path: "/v1/variants/:id",
    summary: "Read a variant",
    tag: "Catalog",
    scope: "products:read",
  },
  {
    method: "patch",
    path: "/v1/variants/:id",
    summary: "Update a variant",
    tag: "Catalog",
    scope: "products:write",
  },

  // Locations & bins
  {
    method: "post",
    path: "/v1/locations",
    summary: "Create a location",
    tag: "Inventory",
    scope: "inventory:write",
  },
  {
    method: "get",
    path: "/v1/locations",
    summary: "List locations",
    tag: "Inventory",
    scope: "inventory:read",
  },
  {
    method: "get",
    path: "/v1/locations/:id",
    summary: "Read a location",
    tag: "Inventory",
    scope: "inventory:read",
  },
  {
    method: "delete",
    path: "/v1/locations/:id",
    summary: "Delete a location",
    tag: "Inventory",
    scope: "inventory:write",
  },
  {
    method: "get",
    path: "/v1/locations/:locationId/bins",
    summary: "List bins in a location",
    tag: "Inventory",
    scope: "inventory:read",
  },
  {
    method: "post",
    path: "/v1/bins",
    summary: "Create a bin",
    tag: "Inventory",
    scope: "inventory:write",
  },
  {
    method: "get",
    path: "/v1/bins/:id",
    summary: "Read a bin",
    tag: "Inventory",
    scope: "inventory:read",
  },

  // Stock
  {
    method: "get",
    path: "/v1/inventory/balances",
    summary: "Stock balances",
    tag: "Inventory",
    scope: "inventory:read",
  },
  {
    method: "get",
    path: "/v1/inventory/movements",
    summary: "Stock movement ledger",
    tag: "Inventory",
    scope: "inventory:read",
  },
  {
    method: "post",
    path: "/v1/inventory/movements",
    summary: "Record a stock movement",
    tag: "Inventory",
    scope: "inventory:write",
  },
  {
    method: "get",
    path: "/v1/inventory/availability",
    summary: "Available to promise",
    tag: "Inventory",
    scope: "inventory:read",
  },
  {
    method: "post",
    path: "/v1/inventory/adjustments",
    summary: "Adjust stock",
    tag: "Inventory",
    scope: "inventory:write",
  },
  {
    method: "post",
    path: "/v1/inventory/reservations",
    summary: "Reserve stock",
    tag: "Inventory",
    scope: "inventory:write",
  },
  {
    method: "post",
    path: "/v1/inventory/reservations/:id/release",
    summary: "Release a reservation",
    tag: "Inventory",
    scope: "inventory:write",
  },

  // Orders
  {
    method: "post",
    path: "/v1/orders",
    summary: "Create an order",
    tag: "Orders",
    scope: "orders:write",
  },
  {
    method: "get",
    path: "/v1/orders",
    summary: "List orders",
    tag: "Orders",
    scope: "orders:read",
  },
  {
    method: "get",
    path: "/v1/orders/:id",
    summary: "Read an order",
    tag: "Orders",
    scope: "orders:read",
  },
  {
    method: "post",
    path: "/v1/orders/:id/validate",
    summary: "Validate an order",
    tag: "Orders",
    scope: "orders:write",
  },
  {
    method: "get",
    path: "/v1/orders/:id/events",
    summary: "Order event timeline",
    tag: "Orders",
    scope: "orders:read",
  },
  {
    method: "post",
    path: "/v1/orders/:id/events",
    summary: "Add an order note",
    tag: "Orders",
    scope: "orders:write",
  },

  // Exceptions
  {
    method: "get",
    path: "/v1/exceptions",
    summary: "List exceptions",
    tag: "Exceptions",
    scope: "orders:read",
  },
  {
    method: "get",
    path: "/v1/exceptions/:id",
    summary: "Read an exception",
    tag: "Exceptions",
    scope: "orders:read",
  },
  {
    method: "post",
    path: "/v1/exceptions/:id/assign",
    summary: "Assign an exception",
    tag: "Exceptions",
    scope: "orders:write",
  },
  {
    method: "post",
    path: "/v1/exceptions/:id/resolve",
    summary: "Resolve an exception",
    tag: "Exceptions",
    scope: "orders:write",
  },
  {
    method: "post",
    path: "/v1/order-exceptions/:id/duplicate-review",
    summary: "Review a suspected duplicate order",
    tag: "Exceptions",
    scope: "orders:write",
  },

  // Shipments
  {
    method: "post",
    path: "/v1/shipments",
    summary: "Create a shipment",
    tag: "Shipments",
    scope: "orders:write",
  },
  {
    method: "get",
    path: "/v1/shipments/:id",
    summary: "Read a shipment",
    tag: "Shipments",
    scope: "orders:read",
  },
  {
    method: "get",
    path: "/v1/shipments/tracking/:trackingNumber",
    summary: "Shipment status by tracking number",
    tag: "Shipments",
    scope: "orders:read",
  },
  {
    method: "get",
    path: "/v1/shipments/:id/status",
    summary: "Shipment status and events",
    tag: "Shipments",
    scope: "orders:read",
  },

  // Public tracking
  {
    method: "get",
    path: "/v1/track",
    summary: "Public order tracking",
    tag: "Tracking",
    public: true,
  },

  // Reports
  {
    method: "get",
    path: "/v1/reports/daily",
    summary: "Daily operations report",
    tag: "Reports",
    scope: "reports:read",
  },

  // Receiving, putaway and cycle counts
  {
    method: "post",
    path: "/v1/receipts",
    summary: "Receive stock into quarantine",
    tag: "Receiving",
    scope: "inventory:write",
  },
  {
    method: "get",
    path: "/v1/receipts",
    summary: "List receipts",
    tag: "Receiving",
    scope: "inventory:read",
  },
  {
    method: "post",
    path: "/v1/receipts/:id/lines/:lineId/release",
    summary: "Release quarantined units into a bin",
    tag: "Receiving",
    scope: "inventory:write",
  },
  {
    method: "get",
    path: "/v1/putaway/suggestion",
    summary: "Suggest a putaway bin",
    tag: "Receiving",
    scope: "inventory:read",
  },
  {
    method: "get",
    path: "/v1/cycle-counts",
    summary: "List cycle counts",
    tag: "Receiving",
    scope: "inventory:read",
  },
  {
    method: "post",
    path: "/v1/cycle-counts/:id/count",
    summary: "Submit a cycle count",
    tag: "Receiving",
    scope: "inventory:write",
  },
  {
    method: "post",
    path: "/v1/cycle-counts/:id/approve",
    summary: "Approve a cycle count and post the variance",
    tag: "Receiving",
    scope: "inventory:write",
  },

  // COD confirmation and risk
  {
    method: "post",
    path: "/v1/cod-tasks",
    summary: "Create a COD confirmation task",
    tag: "COD",
    scope: "orders:write",
  },
  {
    method: "get",
    path: "/v1/cod-tasks",
    summary: "List COD confirmation tasks",
    tag: "COD",
    scope: "orders:read",
  },
  {
    method: "post",
    path: "/v1/cod-tasks/:id/attempt",
    summary: "Record a confirmation attempt",
    tag: "COD",
    scope: "orders:write",
  },
  {
    method: "get",
    path: "/v1/orders/:id/risk-score",
    summary: "Risk score for an order",
    tag: "COD",
    scope: "orders:read",
  },

  // Returns and refunds
  {
    method: "post",
    path: "/v1/returns",
    summary: "Request a return",
    tag: "Returns",
    scope: "orders:write",
  },
  {
    method: "get",
    path: "/v1/returns/:id",
    summary: "Read a return",
    tag: "Returns",
    scope: "orders:read",
  },
  {
    method: "post",
    path: "/v1/returns/:id/transition",
    summary: "Move a return along its lifecycle",
    tag: "Returns",
    scope: "orders:write",
  },
  {
    method: "post",
    path: "/v1/returns/:id/disposition",
    summary: "Disposition a received return",
    tag: "Returns",
    scope: "inventory:write",
  },
  {
    method: "post",
    path: "/v1/refunds",
    summary: "Request a refund",
    tag: "Returns",
    scope: "refunds:approve",
  },
  {
    method: "post",
    path: "/v1/refunds/:id/approve",
    summary: "Approve a refund (four-eyes rule)",
    tag: "Returns",
    scope: "refunds:approve",
  },

  // Settlement and reconciliation
  {
    method: "post",
    path: "/v1/settlements/import",
    summary: "Import a courier settlement file",
    tag: "Settlement",
    scope: "reports:read",
  },
  {
    method: "get",
    path: "/v1/reconciliation/daily",
    summary: "Daily COD reconciliation",
    tag: "Settlement",
    scope: "reports:read",
  },

  // Dead-letter queue
  {
    method: "get",
    path: "/v1/dlq",
    summary: "List dead-lettered messages",
    tag: "DLQ",
    scope: "settings:write",
  },
  {
    method: "post",
    path: "/v1/dlq/:id/replay",
    summary: "Replay one dead-lettered message",
    tag: "DLQ",
    scope: "settings:write",
  },
  {
    method: "post",
    path: "/v1/dlq/replay-batch",
    summary: "Replay a batch of dead-lettered messages",
    tag: "DLQ",
    scope: "settings:write",
  },

  // Routing
  {
    method: "get",
    path: "/v1/routing/preview",
    summary: "Explain the routing choice for an order",
    tag: "Routing",
    scope: "orders:read",
  },

  // Webhooks
  {
    method: "post",
    path: "/v1/webhooks/carriers/:carrier",
    summary: "Carrier status webhook",
    tag: "Webhooks",
    public: true,
  },
  {
    method: "post",
    path: "/v1/webhooks/shopify/orders",
    summary: "Shopify order webhook",
    tag: "Webhooks",
    public: true,
  },
  {
    method: "post",
    path: "/v1/webhook-subscriptions",
    summary: "Create an outbound webhook subscription",
    tag: "Webhooks",
    scope: "settings:write",
  },
  {
    method: "get",
    path: "/v1/webhook-subscriptions",
    summary: "List outbound webhook subscriptions",
    tag: "Webhooks",
    scope: "settings:write",
  },
  {
    method: "delete",
    path: "/v1/webhook-subscriptions/:id",
    summary: "Delete an outbound webhook subscription",
    tag: "Webhooks",
    scope: "settings:write",
  },
  {
    method: "get",
    path: "/v1/webhook-deliveries",
    summary: "List outbound webhook deliveries",
    tag: "Webhooks",
    scope: "settings:write",
  },
  {
    method: "post",
    path: "/v1/webhook-deliveries/:id/replay",
    summary: "Replay a failed outbound webhook delivery",
    tag: "Webhooks",
    scope: "settings:write",
  },
  {
    method: "post",
    path: "/v1/suppliers",
    summary: "Create a supplier",
    tag: "Sourcing",
    scope: "settings:write",
  },
  {
    method: "get",
    path: "/v1/suppliers",
    summary: "List suppliers",
    tag: "Sourcing",
    scope: "settings:write",
  },
  {
    method: "get",
    path: "/v1/reorder/suggestions",
    summary: "Suggested purchase orders from the reorder engine",
    tag: "Sourcing",
    scope: "inventory:read",
  },
  {
    method: "post",
    path: "/v1/purchase-orders",
    summary: "Create a purchase order",
    tag: "Sourcing",
    scope: "inventory:write",
  },
  {
    method: "get",
    path: "/v1/purchase-orders",
    summary: "List purchase orders",
    tag: "Sourcing",
    scope: "inventory:read",
  },
  {
    method: "get",
    path: "/v1/purchase-orders/:id",
    summary: "Read a purchase order",
    tag: "Sourcing",
    scope: "inventory:read",
  },
  {
    method: "post",
    path: "/v1/purchase-orders/:id/transition",
    summary: "Move a purchase order along its lifecycle",
    tag: "Sourcing",
    scope: "inventory:write",
  },
  {
    method: "post",
    path: "/v1/purchase-orders/:id/lines/:lineId/receive",
    summary: "Receive units against a purchase order line",
    tag: "Sourcing",
    scope: "inventory:write",
  },
  {
    method: "get",
    path: "/v1/suppliers/:id/scorecard",
    summary: "Supplier scorecard",
    tag: "Scorecards",
    scope: "reports:read",
  },
  {
    method: "post",
    path: "/v1/purchase-orders/:id/landed-cost",
    summary: "Allocate landed cost to purchase order lines",
    tag: "Scorecards",
    scope: "reports:read",
  },
  {
    method: "get",
    path: "/v1/carriers/:carrier/scorecard",
    summary: "Carrier scorecard",
    tag: "Scorecards",
    scope: "reports:read",
  },
  {
    method: "post",
    path: "/v1/claims",
    summary: "Open a carrier claim",
    tag: "Scorecards",
    scope: "orders:write",
  },
  {
    method: "post",
    path: "/v1/claims/:id/close",
    summary: "Close a carrier claim",
    tag: "Scorecards",
    scope: "orders:write",
  },
  {
    method: "post",
    path: "/v1/tickets",
    summary: "Create a support ticket",
    tag: "Inbox",
    scope: "orders:write",
  },
  {
    method: "get",
    path: "/v1/tickets",
    summary: "List support tickets",
    tag: "Inbox",
    scope: "orders:read",
  },
  {
    method: "post",
    path: "/v1/tickets/:id/assign",
    summary: "Assign a ticket",
    tag: "Inbox",
    scope: "orders:write",
  },
  {
    method: "post",
    path: "/v1/tickets/:id/reply",
    summary: "Reply to a ticket",
    tag: "Inbox",
    scope: "orders:write",
  },
  {
    method: "post",
    path: "/v1/tickets/sweep-overdue",
    summary: "Escalate tickets past their SLA",
    tag: "Inbox",
    scope: "orders:write",
  },
  {
    method: "post",
    path: "/v1/inbox/messages",
    summary: "Ingest an inbound channel message",
    tag: "Inbox",
    scope: "orders:write",
  },
  {
    method: "post",
    path: "/v1/macros",
    summary: "Create a reply macro",
    tag: "Inbox",
    scope: "orders:write",
  },
  {
    method: "get",
    path: "/v1/macros/:key/render",
    summary: "Render a reply macro",
    tag: "Inbox",
    scope: "orders:read",
  },
  {
    method: "get",
    path: "/v1/customers/:id/profile",
    summary: "Unified customer profile",
    tag: "CRM",
    scope: "customers:read",
  },
  {
    method: "post",
    path: "/v1/consents",
    summary: "Record a consent decision",
    tag: "CRM",
    scope: "customers:write",
  },
  {
    method: "post",
    path: "/v1/segments/:key/refresh",
    summary: "Recompute a segment",
    tag: "CRM",
    scope: "customers:write",
  },
  {
    method: "get",
    path: "/v1/segments/:key/members",
    summary: "List segment members",
    tag: "CRM",
    scope: "customers:read",
  },
  {
    method: "post",
    path: "/v1/automations",
    summary: "Create an automation",
    tag: "Automations",
    scope: "settings:write",
  },
  {
    method: "post",
    path: "/v1/automations/run",
    summary: "Run the automations subscribed to an event",
    tag: "Automations",
    scope: "settings:write",
  },
  {
    method: "get",
    path: "/v1/kpis",
    summary: "KPI values for a day",
    tag: "KPIs",
    scope: "reports:read",
  },
  {
    method: "post",
    path: "/v1/alerts/evaluate",
    summary: "Evaluate threshold alerts",
    tag: "KPIs",
    scope: "reports:read",
  },
];

function schemaOf(schema: ZodTypeAny): Record<string, unknown> {
  return zodToJsonSchema(schema, {
    target: "openApi3",
    $refStrategy: "none",
  }) as Record<string, unknown>;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string }[];
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
}

/** Builds the OpenAPI 3.1 document from {@link ROUTE_REGISTRY}. */
export function buildOpenApiDocument(): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of ROUTE_REGISTRY) {
    const pathItem = (paths[route.path] ??= {});
    const operation: Record<string, unknown> = {
      summary: route.summary,
      tags: [route.tag],
      operationId: `${route.method}_${route.path.replace(/[^a-zA-Z0-9]+/g, "_")}`,
    };
    if (route.public) {
      operation.security = [];
    } else {
      operation.security = [{ bearerAuth: [] }, { apiKey: [] }];
      if (route.scope) {
        operation["x-required-scope"] = route.scope;
      }
    }
    const parameters: unknown[] = [];
    for (const match of route.path.matchAll(/:([a-zA-Z0-9_]+)/g)) {
      parameters.push({
        name: match[1],
        in: "path",
        required: true,
        schema: { type: "string" },
      });
    }
    if (parameters.length > 0) {
      operation.parameters = parameters;
    }
    if (route.query) {
      operation.parameters = [
        ...(parameters as unknown[]),
        {
          name: "query",
          in: "query",
          required: false,
          content: {
            "application/json": { schema: schemaOf(route.query) },
          },
        },
      ];
    }
    if (route.body) {
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: schemaOf(route.body) } },
      };
    }
    operation.responses = {
      "200": {
        description: "Success",
        ...(route.response
          ? {
              content: {
                "application/json": { schema: schemaOf(route.response) },
              },
            }
          : {}),
      },
      default: {
        description: "RFC 7807 problem response",
        content: {
          "application/problem+json": {
            schema: {
              type: "object",
              required: ["type", "title", "status"],
              properties: {
                type: { type: "string" },
                title: { type: "string" },
                status: { type: "integer" },
                detail: { type: "string" },
                instance: { type: "string" },
                requestId: { type: "string" },
              },
            },
          },
        },
      },
    };
    pathItem[route.method] = operation;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Ops Hub API",
      version: "1.0.0",
      description:
        "Multi-tenant e-commerce operations API: catalog, inventory, orders, shipments and exceptions.",
    },
    servers: [{ url: "http://localhost:3001" }],
    paths,
    components: {
      schemas: {},
    },
  };
}

/** Every route path in the registry — used by the CI coverage check. */
export function registryPaths(): string[] {
  return ROUTE_REGISTRY.map((r) => `${r.method.toUpperCase()} ${r.path}`);
}
