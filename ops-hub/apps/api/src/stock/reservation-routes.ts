import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { ReservationValidationError } from "./reservation-errors";
import type { ReservationService } from "./reservation-service";
import type { CreateReservationRequest } from "./reservation-types";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new ReservationValidationError("A JSON body is required.");
  }
  return body as Record<string, unknown>;
}

function toActor(actor: { kind: "user" | "apiKey"; id: string }) {
  return {
    type: (actor.kind === "user" ? "user" : "api_key") as "user" | "api_key",
    id: actor.id,
  };
}

export function registerReservationRoutes(
  app: FastifyInstance,
  options: {
    service: ReservationService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/inventory/reservations",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request, reply) => {
      const body = asObject(request.body);
      const principal = requirePrincipal(request);
      const { actor, tenantId } = actorAndTenant(principal);

      const reservationRequest: CreateReservationRequest = {
        variantId: body.variantId as string,
        locationId: body.locationId as string,
        quantity: body.quantity as number,
        ttlSeconds: body.ttlSeconds as number,
      };

      const reservation = await service.reserve(
        reservationRequest,
        tenantId,
        toActor(actor),
      );

      await recordAudit(request, audit, {
        action: "reservation.created",
        objectType: "stock_reservation",
        objectId: reservation.id,
        after: reservation,
      });

      reply.status(201);
      return reservation;
    },
  );

  app.post(
    "/v1/inventory/reservations/:id/release",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const principal = requirePrincipal(request);
      const { actor, tenantId } = actorAndTenant(principal);

      const reservation = await service.release(tenantId, id, toActor(actor));

      await recordAudit(request, audit, {
        action: "reservation.released",
        objectType: "stock_reservation",
        objectId: id,
        after: reservation,
      });

      return reservation;
    },
  );
}
