import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import type { ExportFile, ExportService } from "./service";

/** Each export downloads a CSV file and is recorded in the audit log. */
export function registerExportRoutes(
  app: FastifyInstance,
  options: {
    service: ExportService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  const send = async (
    request: FastifyRequest,
    reply: FastifyReply,
    file: ExportFile,
  ): Promise<string> => {
    const { actor } = actorAndTenant(requirePrincipal(request));
    await recordAudit(request, audit, {
      action: "export.created",
      objectType: "export",
      objectId: file.resource,
      after: { resource: file.resource, rowCount: file.rowCount, by: actor.id },
    });
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header(
      "content-disposition",
      `attachment; filename="${file.filename}"`,
    );
    reply.header("cache-control", "no-store");
    return file.csv;
  };

  app.get(
    "/v1/exports/orders.csv",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request, reply) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return send(request, reply, await service.exportOrders(tenantId));
    },
  );

  app.get(
    "/v1/exports/products.csv",
    { preHandler: requirePermission(requestAuth, "products:read") },
    async (request, reply) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return send(request, reply, await service.exportProducts(tenantId));
    },
  );

  app.get(
    "/v1/exports/inventory.csv",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request, reply) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return send(request, reply, await service.exportInventory(tenantId));
    },
  );

  app.get(
    "/v1/exports/customers.csv",
    { preHandler: requirePermission(requestAuth, "customers:read") },
    async (request, reply) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return send(request, reply, await service.exportCustomers(tenantId));
    },
  );
}
