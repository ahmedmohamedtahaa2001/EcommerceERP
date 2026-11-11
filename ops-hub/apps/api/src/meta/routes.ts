import type { FastifyInstance } from "fastify";

import { requirePermission, type RequestAuthenticator } from "../auth/context";
import { ADJUSTMENT_REASONS } from "../stock/adjustment-reasons";
import { STOCK_BUCKETS } from "../stock/types";

/**
 * Machine-readable enums for UI and agent clients. Each value here is
 * imported from the one module that also enforces it, so this endpoint can
 * never drift from the actual validation.
 */
export function registerMetaRoutes(
  app: FastifyInstance,
  options: { requestAuth: RequestAuthenticator },
): void {
  app.get(
    "/v1/meta/enums",
    { preHandler: requirePermission(options.requestAuth, "inventory:read") },
    async () => ({
      adjustmentReasons: ADJUSTMENT_REASONS,
      stockBuckets: STOCK_BUCKETS,
    }),
  );
}
