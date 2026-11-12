import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import { paginationOf, toPage } from "../platform/list-contract";
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

  app.post(
    "/v1/inventory/transfers",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request, reply) => {
      const body = asObject(request.body);
      const principal = requirePrincipal(request);
      const { actor, tenantId } = actorAndTenant(principal);

      const result = await service.transfer(
        {
          variantId: body.variantId as string,
          fromLocationId: body.fromLocationId as string,
          toLocationId: body.toLocationId as string,
          quantity: body.quantity as number,
          reason: body.reason as string,
        },
        tenantId,
        toMovementActor(actor),
      );

      await recordAudit(request, audit, {
        action: "stock.transferred",
        objectType: "stock_transfer",
        objectId: result.transferId,
        after: result,
      });

      reply.status(201);
      return result;
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
      const { limit, cursor } = paginationOf(request);
      const rows = await service.listMovements(tenantId, {
        ...(query.variantId !== undefined
          ? { variantId: query.variantId }
          : {}),
        ...(query.locationId !== undefined
          ? { locationId: query.locationId }
          : {}),
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit);
      return { movements: page.items, nextCursor: page.nextCursor };
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
      const { limit, cursor } = paginationOf(request);
      const rows = await service.listBalances(tenantId, {
        ...(query.variantId !== undefined
          ? { variantId: query.variantId }
          : {}),
        ...(query.locationId !== undefined
          ? { locationId: query.locationId }
          : {}),
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit, (row) =>
        String((row as { updatedAt?: Date }).updatedAt ?? new Date(0)),
      );
      return { balances: page.items, nextCursor: page.nextCursor };
    },
  );
}
