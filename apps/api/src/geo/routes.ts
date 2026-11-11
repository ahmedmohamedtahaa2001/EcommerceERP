import type { FastifyInstance } from "fastify";

import {
  requirePermission,
  type RequestAuthenticator,
} from "../auth/context";
import {
  listGovernorates,
  listDistricts,
  resolveGovernorate,
  getGovernorate,
} from "@ops-hub/shared";

export function registerGeoRoutes(
  app: FastifyInstance,
  options: { requestAuth: RequestAuthenticator },
): void {
  const { requestAuth } = options;

  app.get(
    "/v1/geo/governorates",
    { preHandler: requirePermission(requestAuth, "geo:read") },
    async () => ({ governorates: listGovernorates() }),
  );

  app.get(
    "/v1/geo/districts",
    { preHandler: requirePermission(requestAuth, "geo:read") },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const governorate = query.governorate;
      const governorateCode =
        typeof governorate === "string" ? resolveGovernorate(governorate) ?? governorate : undefined;
      const districts = listDistricts(governorateCode);
      return { districts };
    },
  );

  app.get(
    "/v1/geo/resolve",
    { preHandler: requirePermission(requestAuth, "geo:read") },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const q = typeof query.q === "string" ? query.q : "";
      return {
        governorateCode: resolveGovernorate(q),
        districtCode: null,
        governorate: resolveGovernorate(q)
          ? getGovernorate(resolveGovernorate(q) as string)
          : null,
      };
    },
  );
}
