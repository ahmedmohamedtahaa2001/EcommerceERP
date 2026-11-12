import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { BulkValidationError } from "./errors";
import type { BulkService } from "./service";
import { requireIds } from "./validation";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BulkValidationError("A JSON object body is required.");
  }
  return body as Record<string, unknown>;
}

/** Bulk changes return one result per item, so a partial failure is visible rather than silent. */
export function registerBulkRoutes(
  app: FastifyInstance,
  options: {
    service: BulkService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/bulk/products/status",
    { preHandler: requirePermission(requestAuth, "products:write") },
    async (request) => {
      const body = asObject(request.body);
      const { actor, tenantId } = actorAndTenant(requirePrincipal(request));
      const ids = requireIds(body.ids);
      const result = await service.setProductStatus(
        tenantId,
        ids,
        String(body.status ?? ""),
      );
      await recordAudit(request, audit, {
        action: "bulk.product_status",
        objectType: "product",
        objectId: "bulk",
        after: {
          status: body.status,
          total: result.total,
          succeeded: result.succeeded,
          failed: result.failed,
          by: actor.id,
        },
      });
      return result;
    },
  );

  app.post(
    "/v1/bulk/products/prices",
    { preHandler: requirePermission(requestAuth, "products:write") },
    async (request) => {
      const body = asObject(request.body);
      const { actor, tenantId } = actorAndTenant(requirePrincipal(request));
      const ids = requireIds(body.productIds);
      const result = await service.changeProductPrices(tenantId, ids, {
        mode: body.mode as "percent" | "set",
        value: body.value as number,
      });
      await recordAudit(request, audit, {
        action: "bulk.product_prices",
        objectType: "variant",
        objectId: "bulk",
        after: {
          mode: body.mode,
          value: body.value,
          total: result.total,
          succeeded: result.succeeded,
          skipped: result.skipped,
          failed: result.failed,
          by: actor.id,
        },
      });
      return result;
    },
  );
}
