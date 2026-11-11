import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import type {
  AdjustmentRequest,
  AdjustmentService,
} from "./adjustment-service";
import { StockValidationError } from "./errors";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new StockValidationError("A JSON body is required.");
  }
  return body as Record<string, unknown>;
}

export function registerAdjustmentRoutes(
  app: FastifyInstance,
  options: {
    service: AdjustmentService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/inventory/adjustments",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request, reply) => {
      const body = asObject(request.body);
      const { actor, tenantId } = actorAndTenant(requirePrincipal(request));

      const adjustmentRequest: AdjustmentRequest = {
        variantId: body.variantId as string,
        locationId: body.locationId as string,
        bucket: body.bucket as AdjustmentRequest["bucket"],
        delta: body.delta as number,
        reason: body.reason as string,
      };
      if (body.reference !== undefined) {
        adjustmentRequest.reference = body.reference as string;
      }

      const movement = await service.adjust(adjustmentRequest, tenantId, {
        type: actor.kind === "user" ? "user" : "api_key",
        id: actor.id,
      });

      await recordAudit(request, audit, {
        action: "stock.adjustment_recorded",
        objectType: "stock_movement",
        objectId: movement.id,
        after: movement,
      });

      reply.status(201);
      return movement;
    },
  );
}
