import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import type { OrderService } from "./service";

export function registerOrderRoutes(
  app: FastifyInstance,
  options: {
    service: OrderService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/orders",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const idempotencyKey = request.headers["idempotency-key"];

      const { result, created } = await service.createOrder(
        tenantId,
        typeof idempotencyKey === "string" ? idempotencyKey : undefined,
        request.body,
      );

      if (created) {
        await recordAudit(request, audit, {
          action: "order.created",
          objectType: "order",
          objectId: result.order.id,
          after: result,
        });
      }

      reply.status(created ? 201 : 200);
      return result;
    },
  );

  app.get(
    "/v1/orders/:id",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getById(tenantId, id);
    },
  );
}
