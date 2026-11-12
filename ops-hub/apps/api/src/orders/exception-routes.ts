import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { OrderValidationError } from "./errors";
import type { ExceptionService } from "./exception-service";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new OrderValidationError("A JSON body is required.");
  }
  return body as Record<string, unknown>;
}

export function registerExceptionRoutes(
  app: FastifyInstance,
  options: {
    service: ExceptionService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.get(
    "/v1/exceptions",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const query = request.query as { status?: string; orderId?: string };
      return {
        exceptions: await service.list(tenantId, {
          ...(query.status !== undefined ? { status: query.status } : {}),
          ...(query.orderId !== undefined ? { orderId: query.orderId } : {}),
        }),
      };
    },
  );

  app.get(
    "/v1/exceptions/:id",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getById(tenantId, id);
    },
  );

  app.post(
    "/v1/exceptions/:id/assign",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = asObject(request.body);
      if (typeof body.ownerId !== "string") {
        throw new OrderValidationError("ownerId is required.");
      }
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      const before = await service.getById(tenantId, id);
      const updated = await service.assign(tenantId, id, body.ownerId);

      await recordAudit(request, audit, {
        action: "exception.assigned",
        objectType: "exception",
        objectId: id,
        before,
        after: updated,
      });

      return updated;
    },
  );

  app.post(
    "/v1/exceptions/:id/resolve",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = asObject(request.body);
      if (typeof body.resolution !== "string") {
        throw new OrderValidationError("resolution is required.");
      }
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      const before = await service.getById(tenantId, id);
      const updated = await service.resolve(tenantId, id, body.resolution);

      await recordAudit(request, audit, {
        action: "exception.resolved",
        objectType: "exception",
        objectId: id,
        before,
        after: updated,
      });

      return updated;
    },
  );
}
