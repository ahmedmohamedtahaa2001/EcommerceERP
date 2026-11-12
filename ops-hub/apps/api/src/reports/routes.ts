import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import type { ReportsService } from "./service";

export function registerReportRoutes(
  app: FastifyInstance,
  options: {
    service: ReportsService;
    requestAuth: RequestAuthenticator;
  },
): void {
  const { service, requestAuth } = options;

  app.get(
    "/v1/reports/daily",
    { preHandler: requirePermission(requestAuth, "reports:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const query = request.query as { date?: string };
      const date = query.date ? new Date(query.date) : new Date();
      return service.daily(
        tenantId,
        Number.isNaN(date.getTime()) ? new Date() : date,
      );
    },
  );
}
