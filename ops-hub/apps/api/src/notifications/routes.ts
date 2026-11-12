import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import type { NotificationService } from "./service";

export function registerNotificationRoutes(
  app: FastifyInstance,
  options: {
    service: NotificationService;
    requestAuth: RequestAuthenticator;
    audit?: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.get(
    "/v1/notifications/templates",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async () => ({ templates: await service.listTemplates() }),
  );

  app.post(
    "/v1/notifications",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await service.notify(tenantId, {
        orderId: String(body.orderId ?? ""),
        templateKey: String(body.templateKey ?? ""),
        to: String(body.to ?? ""),
        vars: (body.vars as Record<string, string>) ?? {},
        ...(body.channel ? { channel: body.channel as "email" } : {}),
      });
      if (audit) {
        await recordAudit(request, audit, {
          action: "notification.sent",
          objectType: "notification",
          objectId: `${body.orderId ?? ""}:${body.templateKey ?? ""}`,
          after: result,
        });
      }
      reply.status(result.sent ? 201 : 200);
      return result;
    },
  );
}
