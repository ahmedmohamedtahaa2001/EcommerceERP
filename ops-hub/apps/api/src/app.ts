import { randomUUID } from "node:crypto";

import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

import { registerApiKeyRoutes } from "./api-keys/routes";
import type { ApiKeyService } from "./api-keys/service";
import { buildOpenApiDocument } from "@ops-hub/contracts";
import { registerAuditRoutes } from "./audit/routes";
import type { AuditReader, AuditWriter } from "./audit/types";
import { registerAuthRoutes } from "./auth/routes";
import { registerCatalogRoutes } from "./catalog/routes";
import type { CatalogImportService } from "./catalog/import-service";
import type { CatalogService } from "./catalog/service";
import type { AuthService } from "./auth/service";
import { CompositeRequestAuthenticator } from "./auth/request-authenticator";
import { registerInventoryRoutes } from "./inventory/routes";
import type { InventoryService } from "./inventory/service";
import { registerGeoRoutes } from "./geo/routes";
import { registerStockRoutes } from "./stock/routes";
import type { StockService } from "./stock/service";
import { registerAvailabilityRoutes } from "./availability/routes";
import type { AvailabilityService } from "./availability/service";
import { registerReservationRoutes } from "./stock/reservation-routes";
import type { ReservationService } from "./stock/reservation-service";
import { registerAdjustmentRoutes } from "./stock/adjustment-routes";
import type { AdjustmentService } from "./stock/adjustment-service";
import { registerMetaRoutes } from "./meta/routes";
import { registerOrderRoutes } from "./orders/routes";
import { registerExceptionRoutes } from "./orders/exception-routes";
import type { ExceptionService } from "./orders/exception-service";
import { registerShipmentRoutes } from "./shipments/routes";
import type { ShipmentService } from "./shipments/service";
import { registerShipmentWebhookRoutes } from "./shipments/webhook-routes";
import { registerCustomerRoutes } from "./customers/routes";
import { registerPutawayRoutes } from "./putaway/routes";
import { registerExportRoutes } from "./exports/routes";
import { registerBulkRoutes } from "./bulk/routes";
import { registerUserRoutes } from "./users/routes";
import type { UserAdminService } from "./users/service";
import type { BulkService } from "./bulk/service";
import type { ExportService } from "./exports/service";
import type { PutawayService } from "./putaway/service";
import type { CustomerService } from "./customers/service";
import type { ShippingCarrier } from "@ops-hub/integrations";
import { registerOutboundWebhookRoutes } from "./webhooks/routes";
import type { OutboundWebhookService } from "./webhooks/outbound-service";
import { registerTrackingRoutes } from "./tracking/routes";
import { registerReportRoutes } from "./reports/routes";
import type { ReportsService } from "./reports/service";
import { registerPhase2Routes, type Phase2Services } from "./phase2/routes";
import { registerPhase3Routes, type Phase3Services } from "./phase3/routes";
import { registerPhase4Routes, type Phase4Services } from "./phase4/routes";
import { registerRateLimit, type RateLimitOptions } from "./platform/service";
import { registerPagination } from "./platform/list-contract";
import { registerNotificationRoutes } from "./notifications/routes";
import type { NotificationService } from "./notifications/service";
import { registerConnectorRoutes } from "./integrations/connectors/routes";
import type { ConnectorHealthService } from "./integrations/connectors/health";
import type { Pool } from "pg";
import type { OrderValidationService } from "./orders/validation-service";
import type { DuplicateDetectionService } from "./orders/duplicate-detection-service";
import type { OrderService } from "./orders/service";

export const REDACT_PATHS = [
  "req.headers.authorization",
  'req.headers["x-api-key"]',
  "req.headers.cookie",
  "headers.authorization",
  'headers["x-api-key"]',
  "headers.cookie",
  "body.apiKey",
  "body.password",
  "body.phone",
  "body.email",
  "apiKey",
  "password",
  "phone",
  "email",
  "*.apiKey",
  "*.password",
  "*.phone",
  "*.email",
];

export const CENSOR = "[REDACTED]";

const PROBLEM_BASE = "https://ops-hub.local/problems";

function problemType(code: string): string {
  const slug = code
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return `${PROBLEM_BASE}/${slug}`;
}

export interface BuildAppOptions {
  logger?: FastifyServerOptions["logger"];
  /** Observability hook: called for every registered route. Used by the
   * OpenAPI coverage check to assert that no route is missing from the
   * published spec. */
  onRoute?: (route: { method: string; url: string }) => void;
  auth?: AuthService;
  apiKeys?: ApiKeyService;
  audit?: AuditWriter;
  auditReader?: AuditReader;
  catalog?: CatalogService;
  catalogImport?: CatalogImportService;
  inventory?: InventoryService;
  stock?: StockService;
  availability?: AvailabilityService;
  reservations?: ReservationService;
  adjustments?: AdjustmentService;
  orders?: OrderService;
  orderValidation?: OrderValidationService;
  duplicateDetection?: DuplicateDetectionService;
  exceptions?: ExceptionService;
  shipments?: ShipmentService;
  customers?: CustomerService;
  putaway?: PutawayService;
  exports?: ExportService;
  bulk?: BulkService;
  userAdmin?: UserAdminService;
  carriers?: Record<string, ShippingCarrier>;
  /** Per-carrier HMAC secrets for inbound carrier webhooks. */
  carrierWebhookSecrets?: Record<string, string | undefined>;
  outboundWebhooks?: OutboundWebhookService;
  /** Pool used by the public tracking route (it reads across tenants by
   * order number and then verifies the phone). */
  trackingPool?: Pool;
  /** The tenant treated as the sandbox by `POST /v1/sandbox/reset`. */
  sandboxTenantId?: string;
  /** Per-principal rate limiting. */
  rateLimit?: RateLimitOptions;
  reports?: ReportsService;
  phase2?: Phase2Services;
  phase3?: Phase3Services;
  phase4?: Phase4Services;
  notifications?: NotificationService;
  connectors?: ConnectorHealthService;
}

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? {
      level: "info",
      redact: { paths: REDACT_PATHS, censor: CENSOR },
    },
    genReqId: (request) => {
      const supplied = request.headers["x-request-id"];
      return typeof supplied === "string" && supplied.length > 0
        ? supplied
        : randomUUID();
    },
  });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  if (options.onRoute) {
    const onRoute = options.onRoute;
    app.addHook("onRoute", (routeOptions) => {
      onRoute({
        method: Array.isArray(routeOptions.method)
          ? (routeOptions.method[0] ?? "GET")
          : routeOptions.method,
        url: routeOptions.url,
      });
    });
  }

  // Fastify's default JSON parser rejects an empty body outright
  // (FST_ERR_CTP_EMPTY_JSON_BODY), which breaks any bodiless POST (e.g.
  // reservation release) whenever the caller still sets
  // `Content-Type: application/json` out of habit. Treat an empty body as
  // `{}` instead; routes that need fields still validate them themselves.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body: string, done) => {
      request.rawBody = body;
      if (body.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(body));
      } catch {
        done(
          Object.assign(new Error("Body is not valid JSON."), {
            statusCode: 400,
            code: "FST_ERR_CTP_INVALID_JSON_BODY",
          }),
          undefined,
        );
      }
    },
  );

  if (options.rateLimit) {
    registerRateLimit(app, options.rateLimit);
  }

  // Every list route shares the same pagination contract.
  registerPagination(app);

  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async () => ({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.get("/v1/openapi.json", async () => buildOpenApiDocument());

  if (options.trackingPool) {
    registerTrackingRoutes(app, { pool: options.trackingPool });
  }

  app.get("/docs", async (_request, reply) => {
    reply.type("text/html");
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Ops Hub API</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
      code { background: #f5f5f3; padding: 0.15rem 0.35rem; border-radius: 4px; }
      li { margin: 0.35rem 0; }
    </style>
  </head>
  <body>
    <h1>Ops Hub API</h1>
    <p>OpenAPI 3.1 spec: <a href="/v1/openapi.json"><code>/v1/openapi.json</code></a></p>
    <ul>
${Object.entries(buildOpenApiDocument().paths)
  .map(
    ([path, item]) =>
      `      <li><code>${Object.keys(item)
        .map((m) => m.toUpperCase())
        .join(" | ")}</code> ${path}</li>`,
  )
  .join("\n")}
    </ul>
  </body>
</html>`;
  });

  if (options.auth || options.apiKeys || options.audit) {
    const requestAuth = new CompositeRequestAuthenticator(
      options.auth,
      options.apiKeys,
    );

    registerGeoRoutes(app, { requestAuth });
    registerMetaRoutes(app, { requestAuth });

    if (options.availability) {
      registerAvailabilityRoutes(app, {
        service: options.availability,
        requestAuth,
      });
    }

    if (options.auth) {
      registerAuthRoutes(app, options.auth, options.audit);
    }
    if (options.apiKeys) {
      if (!options.audit) {
        throw new Error(
          "api-keys routes mutate state and require an audit writer.",
        );
      }
      registerApiKeyRoutes(app, {
        service: options.apiKeys,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.audit && options.auditReader) {
      registerAuditRoutes(app, {
        reader: options.auditReader,
        requestAuth,
      });
    }
    if (options.catalog) {
      if (!options.audit) {
        throw new Error(
          "catalog routes mutate state and require an audit writer.",
        );
      }
      registerCatalogRoutes(app, {
        service: options.catalog,
        requestAuth,
        audit: options.audit,
        ...(options.catalogImport
          ? { importService: options.catalogImport }
          : {}),
      });
    }
    if (options.inventory) {
      if (!options.audit) {
        throw new Error(
          "inventory routes mutate state and require an audit writer.",
        );
      }
      registerInventoryRoutes(app, {
        service: options.inventory,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.stock) {
      if (!options.audit) {
        throw new Error(
          "stock routes mutate state and require an audit writer.",
        );
      }
      registerStockRoutes(app, {
        service: options.stock,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.reservations) {
      if (!options.audit) {
        throw new Error(
          "reservation routes mutate state and require an audit writer.",
        );
      }
      registerReservationRoutes(app, {
        service: options.reservations,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.adjustments) {
      if (!options.audit) {
        throw new Error(
          "adjustment routes mutate state and require an audit writer.",
        );
      }
      registerAdjustmentRoutes(app, {
        service: options.adjustments,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.orders) {
      if (!options.audit) {
        throw new Error(
          "order routes mutate state and require an audit writer.",
        );
      }
      if (!options.orderValidation) {
        throw new Error("order routes require an order validation service.");
      }
      if (!options.duplicateDetection) {
        throw new Error("order routes require a duplicate detection service.");
      }
      registerOrderRoutes(app, {
        service: options.orders,
        validation: options.orderValidation,
        duplicateDetection: options.duplicateDetection,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.exceptions) {
      if (!options.audit) {
        throw new Error(
          "exception routes mutate state and require an audit writer.",
        );
      }
      registerExceptionRoutes(app, {
        service: options.exceptions,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.userAdmin) {
      if (!options.audit) {
        throw new Error("user administration must be audited.");
      }
      registerUserRoutes(app, {
        service: options.userAdmin,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.bulk) {
      if (!options.audit) {
        throw new Error("bulk routes mutate state and must be audited.");
      }
      registerBulkRoutes(app, {
        service: options.bulk,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.exports) {
      if (!options.audit) {
        throw new Error("export routes must be audited.");
      }
      registerExportRoutes(app, {
        service: options.exports,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.putaway) {
      if (!options.audit) {
        throw new Error(
          "putaway routes mutate state and require an audit writer.",
        );
      }
      registerPutawayRoutes(app, {
        service: options.putaway,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.customers) {
      if (!options.audit) {
        throw new Error(
          "customer routes mutate state and require an audit writer.",
        );
      }
      registerCustomerRoutes(app, {
        service: options.customers,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.shipments) {
      if (!options.audit) {
        throw new Error(
          "shipment routes mutate state and require an audit writer.",
        );
      }
      registerShipmentRoutes(app, {
        service: options.shipments,
        requestAuth,
        audit: options.audit,
      });
      if (options.carriers) {
        registerShipmentWebhookRoutes(app, {
          carriers: options.carriers,
          shipments: options.shipments,
          webhookSecrets: options.carrierWebhookSecrets ?? {},
        });
      }
    }
    if (options.reports) {
      registerReportRoutes(app, {
        service: options.reports,
        requestAuth,
      });
    }
    if (options.phase2) {
      if (!options.audit) {
        throw new Error(
          "phase 2 routes mutate state and require an audit writer.",
        );
      }
      registerPhase2Routes(app, {
        services: options.phase2,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.phase3) {
      if (!options.audit) {
        throw new Error(
          "phase 3 routes mutate state and require an audit writer.",
        );
      }
      registerPhase3Routes(app, {
        services: options.phase3,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.notifications) {
      registerNotificationRoutes(app, {
        service: options.notifications,
        requestAuth,
        ...(options.audit !== undefined ? { audit: options.audit } : {}),
      });
    }
    if (options.connectors) {
      if (!options.audit) {
        throw new Error(
          "connector routes mutate state and require an audit writer.",
        );
      }
      registerConnectorRoutes(app, {
        service: options.connectors,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.phase4) {
      if (!options.audit) {
        throw new Error(
          "phase 4 routes mutate state and require an audit writer.",
        );
      }
      registerPhase4Routes(app, {
        services: options.phase4,
        requestAuth,
        audit: options.audit,
        ...(options.sandboxTenantId !== undefined
          ? { sandboxTenantId: options.sandboxTenantId }
          : {}),
      });
    }
    if (options.outboundWebhooks) {
      if (!options.audit) {
        throw new Error(
          "outbound webhook routes mutate state and require an audit writer.",
        );
      }
      registerOutboundWebhookRoutes(app, {
        service: options.outboundWebhooks,
        requestAuth,
        audit: options.audit,
      });
    }
  }

  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .type("application/problem+json")
      .send({
        type: problemType("not-found"),
        title: "Not Found",
        status: 404,
        detail: `Route ${request.method} ${request.url} not found.`,
        instance: request.url,
        requestId: request.id,
      });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    const exposed = status < 500;
    const retryAfterSeconds = (error as { retryAfterSeconds?: unknown })
      .retryAfterSeconds;
    if (typeof retryAfterSeconds === "number") {
      reply.header("retry-after", String(retryAfterSeconds));
    }
    reply
      .status(status)
      .type("application/problem+json")
      .send({
        type: problemType(
          exposed ? (error.code ?? error.name) : "internal-error",
        ),
        title: exposed ? error.name : "Internal Server Error",
        status,
        detail: exposed ? error.message : "An unexpected error occurred.",
        instance: request.url,
        requestId: request.id,
      });
  });

  return app;
}
