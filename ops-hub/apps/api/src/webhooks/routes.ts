import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import type { OutboundWebhookService } from "./outbound-service";

export function registerOutboundWebhookRoutes(
  app: FastifyInstance,
  options: {
    service: OutboundWebhookService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/webhook-subscriptions",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request, reply) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const body = (request.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name : "";
      const url = typeof body.url === "string" ? body.url : "";
      const events = Array.isArray(body.events)
        ? body.events.filter((e): e is string => typeof e === "string")
        : [];
      if (!name || !url || events.length === 0) {
        throw new Error("name, url and events are required.");
      }
      const sub = await service.createSubscription(tenantId, {
        name,
        url,
        events,
        ...(typeof body.secret === "string" ? { secret: body.secret } : {}),
      });
      await recordAudit(request, audit, {
        action: "webhook_subscription.created",
        objectType: "webhook_subscription",
        objectId: sub.id,
        after: { name: sub.name, url: sub.url, events: sub.events },
      });
      reply.status(201);
      return sub;
    },
  );

  app.get(
    "/v1/webhook-subscriptions",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return { subscriptions: await service.listSubscriptions(tenantId) };
    },
  );

  app.delete(
    "/v1/webhook-subscriptions/:id",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const deleted = await service.deleteSubscription(tenantId, id);
      await recordAudit(request, audit, {
        action: "webhook_subscription.deleted",
        objectType: "webhook_subscription",
        objectId: id,
      });
      if (!deleted) {
        reply.status(404);
        return { error: "not found" };
      }
      return { deleted: true };
    },
  );

  app.get(
    "/v1/webhook-deliveries",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const query = request.query as {
        subscriptionId?: string;
        status?: string;
      };
      return {
        deliveries: await service.listDeliveries(tenantId, {
          ...(query.subscriptionId !== undefined
            ? { subscriptionId: query.subscriptionId }
            : {}),
          ...(query.status !== undefined ? { status: query.status } : {}),
        }),
      };
    },
  );

  app.post(
    "/v1/webhook-deliveries/:id/replay",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const delivery = await service.replay(tenantId, id);
      await recordAudit(request, audit, {
        action: "webhook_delivery.replayed",
        objectType: "webhook_delivery",
        objectId: id,
        after: delivery,
      });
      return delivery;
    },
  );
}
