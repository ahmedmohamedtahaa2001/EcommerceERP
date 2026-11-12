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
import type { ShipmentService } from "./service";

export function registerShipmentRoutes(
  app: FastifyInstance,
  options: {
    service: ShipmentService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/shipments",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const body = (request.body ?? {}) as Record<string, unknown>;
      const shipment = await service.createShipment(tenantId, {
        orderId: String(body.orderId),
        sequence: typeof body.sequence === "number" ? body.sequence : 1,
        ...(typeof body.carrier === "string" ? { carrier: body.carrier } : {}),
        ...(typeof body.serviceLevel === "string"
          ? { serviceLevel: body.serviceLevel }
          : {}),
        recipient: (body.recipient as { name?: string; phone: string }) ?? {
          phone: "",
        },
        address: (body.address as {
          line1: string;
          governorateCode?: string;
        }) ?? {
          line1: "",
        },
        items: (body.items as { sku: string; quantity: number }[]) ?? [],
        ...(body.codAmount
          ? {
              codAmount: body.codAmount as {
                amountMinor: number;
                currency: string;
              },
            }
          : {}),
      });
      await recordAudit(request, audit, {
        action: "shipment.created",
        objectType: "shipment",
        objectId: shipment.id,
        after: shipment,
      });
      reply.status(201);
      return shipment;
    },
  );

  app.get(
    "/v1/shipments",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const query = request.query as { orderId?: string; status?: string };
      const { limit, cursor } = paginationOf(request);
      const rows = await service.list(tenantId, {
        ...(query.orderId !== undefined ? { orderId: query.orderId } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit);
      return { shipments: page.items, nextCursor: page.nextCursor };
    },
  );

  app.get(
    "/v1/shipments/:id",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getById(tenantId, id);
    },
  );

  app.get(
    "/v1/shipments/tracking/:trackingNumber",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { trackingNumber } = request.params as { trackingNumber: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getStatusByTrackingNumber(tenantId, trackingNumber);
    },
  );

  app.get(
    "/v1/shipments/:id/status",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getStatus(tenantId, id);
    },
  );
}
