import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { AvailabilityValidationError } from "./errors";
import type { AvailabilityService } from "./service";

export function registerAvailabilityRoutes(
  app: FastifyInstance,
  options: { service: AvailabilityService; requestAuth: RequestAuthenticator },
): void {
  const { service, requestAuth } = options;

  app.get(
    "/v1/inventory/availability",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const query = request.query as { sku?: string; location?: string };

      if (typeof query.sku !== "string" || query.sku.trim() === "") {
        throw new AvailabilityValidationError(
          "sku query parameter is required.",
        );
      }

      return service.getAvailability(tenantId, query.sku, query.location);
    },
  );
}
