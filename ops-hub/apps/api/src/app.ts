import { randomUUID } from "node:crypto";

import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

import { registerApiKeyRoutes } from "./api-keys/routes";
import type { ApiKeyService } from "./api-keys/service";
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

  // Fastify's default JSON parser rejects an empty body outright
  // (FST_ERR_CTP_EMPTY_JSON_BODY), which breaks any bodiless POST (e.g.
  // reservation release) whenever the caller still sets
  // `Content-Type: application/json` out of habit. Treat an empty body as
  // `{}` instead; routes that need fields still validate them themselves.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body: string, done) => {
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

  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async () => ({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
  }));

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
