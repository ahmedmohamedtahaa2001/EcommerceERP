import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { ValidationError } from "../auth/errors";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import {
  BinNotFoundError,
  LocationNotFoundError,
} from "./errors";
import { LocationService } from "./service";

function requireObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("request body must be an object.");
  }
  return body as Record<string, unknown>;
}

function readOptional(body: Record<string, unknown>, key: string): unknown {
  return body[key];
}

export function registerLocationRoutes(
  app: FastifyInstance,
  options: {
    service: LocationService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/locations",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request, reply) => {
      const body = requireObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const input: Parameters<typeof service.createLocation>[0] = {
        type: readOptional(body, "type") as never,
        name: readOptional(body, "name") as string,
      };
      if (body.code !== undefined)
        input.code = readOptional(body, "code") as string | null;
      if (body.governorateCode !== undefined)
        input.governorateCode = readOptional(body, "governorateCode") as string | null;
      if (body.address !== undefined)
        input.address = readOptional(body, "address") as string | null;
      const created = await service.createLocation(input, tenantId);

      await recordAudit(request, audit, {
        action: "location.created",
        objectType: "location",
        objectId: created.id,
        after: created,
      });

      reply.status(201);
      return created;
    },
  );

  app.get(
    "/v1/locations",
    { preHandler: requirePermission(requestAuth, "catalog:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const locations = await service.listLocations(tenantId);
      return { locations };
    },
  );

  app.get(
    "/v1/locations/:id",
    { preHandler: requirePermission(requestAuth, "catalog:read") },
    async (request) => {
      const { id } = request.params as { id?: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const location = id ? await service.getLocation(tenantId, id) : null;
      if (!location) throw new LocationNotFoundError();
      const bins = await service.listBinsByLocation(tenantId, location.id);
      return { location, bins };
    },
  );

  app.patch(
    "/v1/locations/:id",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request) => {
      const { id } = request.params as { id?: string };
      if (!id) throw new LocationNotFoundError();
      const body = requireObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const before = await service.getLocation(tenantId, id);
      if (!before) throw new LocationNotFoundError();
      const input: Parameters<typeof service.updateLocation>[2] = {};
      if (body.type !== undefined)
        input.type = readOptional(body, "type") as never;
      if (body.name !== undefined)
        input.name = readOptional(body, "name") as string;
      if (body.code !== undefined)
        input.code = readOptional(body, "code") as string | null;
      if (body.governorateCode !== undefined)
        input.governorateCode = readOptional(body, "governorateCode") as string | null;
      if (body.address !== undefined)
        input.address = readOptional(body, "address") as string | null;
      const updated = await service.updateLocation(tenantId, id, input);

      await recordAudit(request, audit, {
        action: "location.updated",
        objectType: "location",
        objectId: id,
        before,
        after: updated,
      });

      return updated;
    },
  );

  app.delete(
    "/v1/locations/:id",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request, reply) => {
      const { id } = request.params as { id?: string };
      if (!id) throw new LocationNotFoundError();
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const before = await service.getLocation(tenantId, id);
      if (!before) throw new LocationNotFoundError();
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
    "/v1/locations/:id/bins",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request, reply) => {
      const { id: locationId } = request.params as { id?: string };
      if (!locationId) throw new LocationNotFoundError();
      const body = requireObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const input: Parameters<typeof service.createBin>[2] = {
        code: readOptional(body, "code") as string,
      };
      if (body.zone !== undefined)
        input.zone = readOptional(body, "zone") as string | null;
      if (body.capacity !== undefined)
        input.capacity = readOptional(body, "capacity") as number | null;
      const created = await service.createBin(tenantId, locationId, input);

      await recordAudit(request, audit, {
        action: "bin.created",
        objectType: "bin",
        objectId: created.id,
        after: created,
      });

      reply.status(201);
      return created;
    },
  );

  app.get(
    "/v1/locations/:id/bins",
    { preHandler: requirePermission(requestAuth, "catalog:read") },
    async (request) => {
      const { id: locationId } = request.params as { id?: string };
      if (!locationId) throw new LocationNotFoundError();
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const bins = await service.listBinsByLocation(tenantId, locationId);
      return { bins };
    },
  );

  app.get(
    "/v1/bins/:id",
    { preHandler: requirePermission(requestAuth, "catalog:read") },
    async (request) => {
      const { id } = request.params as { id?: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const bin = id ? await service.getBin(tenantId, id) : null;
      if (!bin) throw new BinNotFoundError();
      return bin;
    },
  );

  app.patch(
    "/v1/bins/:id",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request) => {
      const { id } = request.params as { id?: string };
      if (!id) throw new BinNotFoundError();
      const body = requireObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const before = await service.getBin(tenantId, id);
      if (!before) throw new BinNotFoundError();
      const input: Parameters<typeof service.updateBin>[2] = {};
      if (body.zone !== undefined)
        input.zone = readOptional(body, "zone") as string | null;
      if (body.code !== undefined)
        input.code = readOptional(body, "code") as string;
      if (body.capacity !== undefined)
        input.capacity = readOptional(body, "capacity") as number | null;
      const updated = await service.updateBin(tenantId, id, input);

      await recordAudit(request, audit, {
        action: "bin.updated",
        objectType: "bin",
        objectId: id,
        before,
        after: updated,
      });

      return updated;
    },
  );

  app.delete(
    "/v1/bins/:id",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request, reply) => {
      const { id } = request.params as { id?: string };
      if (!id) throw new BinNotFoundError();
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const before = await service.getBin(tenantId, id);
      if (!before) throw new BinNotFoundError();
      await service.deleteBin(tenantId, id);

      await recordAudit(request, audit, {
        action: "bin.deleted",
        objectType: "bin",
        objectId: id,
        before,
      });

      reply.status(204);
    },
  );
}
