import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { ValidationError } from "../auth/errors";
import { recordAudit } from "../audit/record";
import { paginationOf, toPage } from "../platform/list-contract";
import type { AuditWriter } from "../audit/types";
import { ApiKeyNotFoundError } from "./errors";
import type { ApiKeyService } from "./service";

function requireStringArray(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new ValidationError(`${field} must be an array of strings.`);
  }
  return value as string[];
}

export function registerApiKeyRoutes(
  app: FastifyInstance,
  options: {
    service: ApiKeyService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

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

      await recordAudit(request, audit, {
        action: "api_key.created",
        objectType: "api_key",
        objectId: created.summary.id,
        after: created.summary,
      });

      reply.status(201);
      return { ...created.summary, secret: created.secret };
    },
  );

  app.get(
    "/v1/api-keys",
    { preHandler: requirePermission(requestAuth, "api_keys:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const { limit, cursor } = paginationOf(request);
      const rows = await service.list(tenantId, { limit: limit + 1, cursor });
      const page = toPage(rows, limit);
      return { keys: page.items, nextCursor: page.nextCursor };
    },
  );

  app.delete(
    "/v1/api-keys/:id",
    { preHandler: requirePermission(requestAuth, "api_keys:write") },
    async (request, reply) => {
      const { id } = request.params as { id?: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      const revoked = id ? await service.revoke(tenantId, id) : null;
      if (!revoked) {
        throw new ApiKeyNotFoundError();
      }

      await recordAudit(request, audit, {
        action: "api_key.revoked",
        objectType: "api_key",
        objectId: id ?? null,
        before: revoked.before,
        after: { ...revoked.before, revokedAt: revoked.revokedAt },
      });

      reply.status(204);
    },
  );
}
