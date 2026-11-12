import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../../auth/context";
import { recordAudit } from "../../audit/record";
import type { AuditWriter } from "../../audit/types";
import type { ConnectorHealthService } from "./health";

export function registerConnectorRoutes(
  app: FastifyInstance,
  options: {
    service: ConnectorHealthService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.get(
    "/v1/connectors",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return { connectors: await service.list(tenantId) };
    },
  );

  app.post(
    "/v1/connectors/:name/success",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { name } = request.params as { name: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      await service.recordSuccess(tenantId, name);
      await recordAudit(request, audit, {
        action: "connector.succeeded",
        objectType: "connector",
        objectId: name,
      });
      return { name, ok: true };
    },
  );

  app.post(
    "/v1/connectors/:name/failure",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { name } = request.params as { name: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const body = (request.body ?? {}) as Record<string, unknown>;
      const health = await service.recordFailure(
        tenantId,
        name,
        String(body.error ?? "unknown error"),
      );
      await recordAudit(request, audit, {
        action: "connector.failed",
        objectType: "connector",
        objectId: name,
        after: health,
      });
      return health;
    },
  );
}
