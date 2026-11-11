import { randomUUID } from "node:crypto";

import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

import { registerApiKeyRoutes } from "./api-keys/routes";
import type { ApiKeyService } from "./api-keys/service";
import { registerAuthRoutes } from "./auth/routes";
import type { AuthService } from "./auth/service";
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

  if (options.auth || options.apiKeys) {
    const requestAuth = new CompositeRequestAuthenticator(
      options.auth,
      options.apiKeys,
    );

    if (options.auth) {
      registerAuthRoutes(app, options.auth);
    }
    if (options.apiKeys) {
      registerApiKeyRoutes(app, { service: options.apiKeys, requestAuth });
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
