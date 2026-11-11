import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { StockValidationError } from "./errors";
import type { StockService } from "./service";
import type { CreateMovementRequest, MovementActor } from "./types";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new StockValidationError("A JSON body is required.");
  }
  return body as Record<string, unknown>;
}

function toMovementActor(actor: {
  kind: "user" | "apiKey";
  id: string;
}): MovementActor {
  return { type: actor.kind === "user" ? "user" : "api_key", id: actor.id };
}

export function registerStockRoutes(
  app: FastifyInstance,
  options: {
    service: StockService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/inventory/movements",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request, reply) => {
      const body = asObject(request.body);
      const principal = requirePrincipal(request);
      const { actor, tenantId } = actorAndTenant(principal);

      const movementRequest: CreateMovementRequest = {
        variantId: body.variantId as string,
        locationId: body.locationId as string,
        bucket: body.bucket as CreateMovementRequest["bucket"],
        delta: body.delta as number,
        reason: body.reason as string,
      };
      if (body.reference !== undefined) {
        movementRequest.reference = body.reference as string;
      }

      const { movement, balance } = await service.recordMovement(
        movementRequest,
        tenantId,
        toMovementActor(actor),
      );

      await recordAudit(request, audit, {
        action: "stock.movement_recorded",
        objectType: "stock_movement",
        objectId: movement.id,
        after: movement,
      });

      reply.status(201);
      return { movement, balance };
    },
  );

  app.get(
    "/v1/inventory/movements",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const query = request.query as {
        variantId?: string;
        locationId?: string;
      };
      return {
        movements: await service.listMovements(tenantId, {
          ...(query.variantId !== undefined
            ? { variantId: query.variantId }
            : {}),
          ...(query.locationId !== undefined
            ? { locationId: query.locationId }
            : {}),
        }),
      };
    },
  );

  app.get(
    "/v1/inventory/balances",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const query = request.query as {
        variantId?: string;
        locationId?: string;
      };
      return {
        balances: await service.listBalances(tenantId, {
          ...(query.variantId !== undefined
            ? { variantId: query.variantId }
            : {}),
          ...(query.locationId !== undefined
            ? { locationId: query.locationId }
            : {}),
        }),
      };
    },
  );
}
