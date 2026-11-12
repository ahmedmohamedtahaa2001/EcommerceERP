import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { CompanyValidationError } from "./errors";
import type { CompanyService } from "./service";
import { requireCompanyPatch } from "./validation";

export function registerCompanyRoutes(
  app: FastifyInstance,
  options: {
    service: CompanyService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.get(
    "/v1/settings/company",
    { preHandler: requirePermission(requestAuth, "settings:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const profile = await service.get(tenantId);
      if (!profile)
        throw new CompanyValidationError("Business profile not found.");
      return profile;
    },
  );

  app.patch(
    "/v1/settings/company",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const body = request.body;
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new CompanyValidationError("A JSON object body is required.");
      }
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const patch = requireCompanyPatch(body as Record<string, unknown>);
      const before = await service.get(tenantId);
      const after = await service.update(tenantId, patch);
      if (!after)
        throw new CompanyValidationError("Business profile not found.");
      await recordAudit(request, audit, {
        action: "company.updated",
        objectType: "tenant",
        objectId: tenantId,
        before,
        after,
      });
      return after;
    },
  );
}
