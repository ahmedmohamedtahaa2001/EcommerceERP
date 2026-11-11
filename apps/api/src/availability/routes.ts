import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { ValidationError } from "../auth/errors";
import { AvailabilityService } from "./service";

export function registerAvailabilityRoutes(
  app: FastifyInstance,
  options: { service: AvailabilityService; requestAuth: RequestAuthenticator },
): void {
  const { service, requestAuth } = options;

  app.get(
    "/v1/inventory/availability",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const sku = typeof query.sku === "string" ? query.sku.trim() : "";
      if (sku === "") {
        throw new ValidationError("sku is required.");
      }
      const locationId =
        typeof query.location === "string" && query.location.trim() !== ""
          ? query.location.trim()
          : undefined;
      const allowNegative =
        query.allowNegative === "true" || query.allowNegative === "1";
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getAvailability(tenantId, sku, locationId, allowNegative);
    },
  );
}
