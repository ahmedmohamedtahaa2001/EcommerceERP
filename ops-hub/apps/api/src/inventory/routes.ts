import { paginationOf, toPage } from "../platform/list-contract";
import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { InventoryValidationError } from "./errors";
import type { InventoryService } from "./service";
import type { CreateBinRequest, CreateLocationRequest } from "./types";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new InventoryValidationError("A JSON body is required.");
  }
  return body as Record<string, unknown>;
}

/** Copies only the keys that are present, so optional fields are omitted
 * rather than set to `undefined` (required under exactOptionalPropertyTypes). */
function pick<T extends object>(
  source: Record<string, unknown>,
  keys: readonly (keyof T)[],
): T {
  const result = {} as T;
  for (const key of keys) {
    if (source[key as string] !== undefined) {
      result[key] = source[key as string] as T[keyof T];
    }
  }
  return result;
}

export function registerInventoryRoutes(
  app: FastifyInstance,
  options: {
    service: InventoryService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/locations",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request, reply) => {
      const body = asObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      const location = await service.createLocation(
        pick<CreateLocationRequest>(body, [
          "type",
          "name",
          "code",
          "governorateCode",
          "address",
        ]),
        tenantId,
      );

      await recordAudit(request, audit, {
        action: "location.created",
        objectType: "location",
        objectId: location.id,
        after: location,
      });

      reply.status(201);
      return location;
    },
  );

  app.get(
    "/v1/locations",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const { limit, cursor } = paginationOf(request);
      const rows = await service.listLocations(tenantId, {
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit);
      return { locations: page.items, nextCursor: page.nextCursor };
    },
  );

  app.get(
    "/v1/locations/:id",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getLocation(tenantId, id);
    },
  );

  app.delete(
    "/v1/locations/:id",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      const before = await service.getLocation(tenantId, id);
      await service.deleteLocation(tenantId, id);

      await recordAudit(request, audit, {
        action: "location.deleted",
        objectType: "location",
        objectId: id,
        before,
      });

      reply.status(204);
    },
  );

  app.post(
    "/v1/bins",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request, reply) => {
      const body = asObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      const bin = await service.createBin(
        pick<CreateBinRequest>(body, [
          "locationId",
          "zone",
          "code",
          "capacity",
        ]),
        tenantId,
      );

      await recordAudit(request, audit, {
        action: "bin.created",
        objectType: "bin",
        objectId: bin.id,
        after: bin,
      });

      reply.status(201);
      return bin;
    },
  );

  app.get(
    "/v1/locations/:locationId/bins",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { locationId } = request.params as { locationId: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return { bins: await service.listBins(tenantId, locationId) };
    },
  );

  app.get(
    "/v1/bins/:id",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getBin(tenantId, id);
    },
  );
}
