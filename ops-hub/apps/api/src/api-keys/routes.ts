import type { FastifyInstance } from "fastify";

import {
  requirePermission,
  type Principal,
  type RequestAuthenticator,
} from "../auth/context";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../auth/errors";
import { ApiKeyNotFoundError } from "./errors";
import type { ApiKeyService } from "./service";
import type { ApiKeyActor } from "./types";

function requirePrincipal(request: { principal?: Principal }): Principal {
  if (!request.principal) {
    throw new UnauthorizedError();
  }
  return request.principal;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new ValidationError(`${field} must be an array of strings.`);
  }
  return value as string[];
}

function actorAndTenant(principal: Principal): {
  actor: ApiKeyActor;
  tenantId: string;
} {
  if (principal.kind === "apiKey") {
    return {
      actor: { kind: "apiKey", id: principal.apiKey.id },
      tenantId: principal.apiKey.tenantId,
    };
  }
  const user = principal.user;
  if (!user.tenantId) {
    throw new ForbiddenError("tenant membership");
  }
  return { actor: { kind: "user", id: user.id }, tenantId: user.tenantId };
}

export function registerApiKeyRoutes(
  app: FastifyInstance,
  options: { service: ApiKeyService; requestAuth: RequestAuthenticator },
): void {
  const { service, requestAuth } = options;

  app.post(
    "/v1/api-keys",
    { preHandler: requirePermission(requestAuth, "api_keys:write") },
    async (request, reply) => {
      const body = request.body;
      if (typeof body !== "object" || body === null) {
        throw new ValidationError("name and scopes are required.");
      }
      const { name, scopes, ipAllowlist } = body as {
        name?: unknown;
        scopes?: unknown;
        ipAllowlist?: unknown;
      };

      if (typeof name !== "string") {
        throw new ValidationError("name and scopes are required.");
      }
      const scopeList = requireStringArray(scopes, "scopes");
      const allowlist =
        ipAllowlist === undefined || ipAllowlist === null
          ? undefined
          : requireStringArray(ipAllowlist, "ipAllowlist");

      const { actor, tenantId } = actorAndTenant(requirePrincipal(request));
      const created = await service.create(
        { name, scopes: scopeList, ipAllowlist: allowlist },
        actor,
        tenantId,
      );

      reply.status(201);
      return { ...created.summary, secret: created.secret };
    },
  );

  app.get(
    "/v1/api-keys",
    { preHandler: requirePermission(requestAuth, "api_keys:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return { keys: await service.list(tenantId) };
    },
  );

  app.delete(
    "/v1/api-keys/:id",
    { preHandler: requirePermission(requestAuth, "api_keys:write") },
    async (request, reply) => {
      const { id } = request.params as { id?: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      const revoked = id
        ? await service.revoke(tenantId, id)
        : false;
      if (!revoked) {
        throw new ApiKeyNotFoundError();
      }
      reply.status(204);
    },
  );
}
