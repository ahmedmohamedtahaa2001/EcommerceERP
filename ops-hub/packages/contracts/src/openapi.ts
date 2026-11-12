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
