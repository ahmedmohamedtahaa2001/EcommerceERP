import { DISTRICTS, GOVERNORATES } from "@ops-hub/domain";
import type { FastifyInstance } from "fastify";

import { requirePermission, type RequestAuthenticator } from "../auth/context";

/**
 * Read-only reference data: every governorate and district, with their
 * canonical codes and alternate spellings. Gated behind `orders:read` since
 * every role that can see orders needs this to resolve an address.
 */
export function registerGeoRoutes(
  app: FastifyInstance,
  options: { requestAuth: RequestAuthenticator },
): void {
  const { requestAuth } = options;

  app.get(
    "/v1/geo/governorates",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async () => ({ governorates: GOVERNORATES }),
  );

  app.get(
    "/v1/geo/districts",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { governorateCode } = request.query as {
        governorateCode?: string;
      };
      const districts =
        governorateCode !== undefined
          ? DISTRICTS.filter((d) => d.governorateCode === governorateCode)
          : DISTRICTS;
      return { districts };
    },
  );
}
