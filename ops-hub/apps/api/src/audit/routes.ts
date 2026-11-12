import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { ValidationError } from "../auth/errors";
import { paginationOf, toPage } from "../platform/list-contract";
import { AUDIT_DEFAULT_LIMIT, AUDIT_MAX_LIMIT } from "./types";
import type { AuditQuery, AuditReader } from "./types";

export function registerAuditRoutes(
  app: FastifyInstance,
  options: { reader: AuditReader; requestAuth: RequestAuthenticator },
): void {
  const { reader, requestAuth } = options;

  app.get(
    "/v1/audit",
    { preHandler: requirePermission(requestAuth, "audit:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const query = (request.query ?? {}) as {
        object?: unknown;
        objectId?: unknown;
        limit?: unknown;
      };

      const { cursor } = paginationOf(request);
      const parsed: AuditQuery = { limit: AUDIT_DEFAULT_LIMIT };
      if (query.limit !== undefined) {
        if (typeof query.limit !== "string" || !/^\d+$/.test(query.limit)) {
          throw new ValidationError(`limit must be an integer.`);
        }
        const limit = Number(query.limit);
        if (limit < 1 || limit > AUDIT_MAX_LIMIT) {
          throw new ValidationError(
            `limit must be between 1 and ${AUDIT_MAX_LIMIT}.`,
          );
        }
        parsed.limit = limit;
      }

      if (typeof query.object === "string" && query.object !== "") {
        const [objectType, objectId] = query.object.split(":");
        if (objectType) {
          parsed.objectType = objectType;
        }
        if (objectId) {
          parsed.objectId = objectId;
        }
      }
      if (typeof query.objectId === "string" && query.objectId !== "") {
        parsed.objectId = query.objectId;
      }

      const rows = await reader.list(tenantId, {
        ...parsed,
        ...(cursor !== null ? { cursor } : {}),
      });
      // A full page means there may be more; the next cursor then returns
      // an empty page when this was the last one.
      const page = toPage(rows, parsed.limit, (row) =>
        String((row as { createdAt?: Date }).createdAt ?? new Date(0)),
      );
      return { entries: page.items, nextCursor: page.nextCursor };
    },
  );
}
