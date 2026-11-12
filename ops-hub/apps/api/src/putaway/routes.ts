import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { PutawayValidationError } from "./errors";
import type { PutawayService } from "./service";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new PutawayValidationError("A JSON object body is required.");
  }
  return body as Record<string, unknown>;
}

export function registerPutawayRoutes(
  app: FastifyInstance,
  options: {
    service: PutawayService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/bins/:id/putaway",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = asObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      const result = await service.putAway(tenantId, id, {
        variantId: body.variantId as string,
        quantity: body.quantity as number,
      });

      await recordAudit(request, audit, {
        action: "bin.put_away",
        objectType: "bin",
        objectId: id,
        after: result,
      });

      reply.status(201);
      return result;
    },
  );

  app.get(
    "/v1/bins/:id/contents",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return { items: await service.contents(tenantId, id) };
    },
  );
}
