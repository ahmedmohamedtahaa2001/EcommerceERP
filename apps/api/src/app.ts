import { randomUUID } from "node:crypto";

import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import multipart from "@fastify/multipart";

import { registerApiKeyRoutes } from "./api-keys/routes";
import type { ApiKeyService } from "./api-keys/service";
import { registerAuditRoutes } from "./audit/routes";
import type { AuditReader, AuditWriter } from "./audit/types";
import { registerAuthRoutes } from "./auth/routes";
import type { AuthService } from "./auth/service";
import { registerAvailabilityRoutes } from "./availability/routes";
import type { AvailabilityService } from "./availability/service";
import { registerCatalogRoutes } from "./catalog/routes";
import type { CatalogService } from "./catalog/service";
import { registerGeoRoutes } from "./geo/routes";
import { registerLocationRoutes } from "./locations/routes";
import type { LocationService } from "./locations/service";
import { registerStockRoutes } from "./stock/routes";
import type { StockService } from "./stock/service";
import {
  CompositeRequestAuthenticator,
} from "./auth/request-authenticator";

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
  catalog?: CatalogService;
  locations?: LocationService;
  stock?: StockService;
  availability?: AvailabilityService;
  audit?: AuditWriter;
  auditReader?: AuditReader;
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
    if (options.catalog) {
      if (!options.audit) {
        throw new Error(
          "catalog routes mutate state and require an audit writer.",
        );
      }
      app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
      registerCatalogRoutes(app, {
        service: options.catalog,
        requestAuth,
        audit: options.audit,
      });
    }
    if (options.locations) {
      if (!options.audit) {
        throw new Error(
          "location routes mutate state and require an audit writer.",
        );
      }
      registerLocationRoutes(app, {
        service: options.locations,
        requestAuth,
        audit: options.audit,
      });
    }
    registerGeoRoutes(app, { requestAuth });
    if (options.stock) {
      registerStockRoutes(app, {
        service: options.stock,
        requestAuth,
      });
    }
    if (options.availability) {
      registerAvailabilityRoutes(app, {
        service: options.availability,
        requestAuth,
      });
    }
    if (options.audit && options.auditReader) {
      registerAuditRoutes(app, {
        reader: options.auditReader,
        requestAuth,
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
