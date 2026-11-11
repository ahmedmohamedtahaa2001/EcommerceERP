import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { ValidationError } from "../auth/errors";
import { StockService } from "./service";

export function registerStockRoutes(
  app: FastifyInstance,
  options: { service: StockService; requestAuth: RequestAuthenticator },
): void {
  const { service, requestAuth } = options;

  app.get(
    "/v1/stock/balances",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const variantId = typeof query.variantId === "string" ? query.variantId : undefined;
      const locationId = typeof query.locationId === "string" ? query.locationId : undefined;
      if (!variantId || !locationId) {
        throw new ValidationError("variantId and locationId are required.");
      }
      const balances = await service.getBalances(tenantId, variantId, locationId);
      return { variantId, locationId, balances };
    },
  );

  app.get(
    "/v1/stock/movements",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const variantId = typeof query.variantId === "string" ? query.variantId : undefined;
      const locationId = typeof query.locationId === "string" ? query.locationId : undefined;
      const filters: { variantId?: string; locationId?: string } = {};
      if (variantId) filters.variantId = variantId;
      if (locationId) filters.locationId = locationId;
      const movements = await service.listMovements(tenantId, filters);
      return { movements };
    },
  );
}
