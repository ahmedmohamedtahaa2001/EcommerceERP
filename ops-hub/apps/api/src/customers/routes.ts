import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { paginationOf, toPage } from "../platform/list-contract";
import { CustomerValidationError } from "./errors";
import type { CustomerService } from "./service";
import type { CreateCustomerRequest, UpdateCustomerRequest } from "./types";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new CustomerValidationError("A JSON object body is required.");
  }
  return body as Record<string, unknown>;
}

export function registerCustomerRoutes(
  app: FastifyInstance,
  options: {
    service: CustomerService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.get(
    "/v1/customers",
    { preHandler: requirePermission(requestAuth, "customers:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const { q } = request.query as { q?: string };
      const { limit, cursor } = paginationOf(request);
      const rows = await service.list(tenantId, {
        ...(q !== undefined ? { q } : {}),
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit);
      return { customers: page.items, nextCursor: page.nextCursor };
    },
  );

  app.post(
    "/v1/customers",
    { preHandler: requirePermission(requestAuth, "customers:write") },
    async (request, reply) => {
      const body = asObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const customer = await service.create(
        tenantId,
        pick<CreateCustomerRequest>(body, ["phone", "fullName", "email"]),
      );
      await recordAudit(request, audit, {
        action: "customer.created",
        objectType: "customer",
        objectId: customer.id,
        after: customer,
      });
      reply.status(201);
      return customer;
    },
  );

  app.get(
    "/v1/customers/:id",
    { preHandler: requirePermission(requestAuth, "customers:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.get(tenantId, id);
    },
  );

  app.patch(
    "/v1/customers/:id",
    { preHandler: requirePermission(requestAuth, "customers:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = asObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const before = (await service.get(tenantId, id)).customer;
      const updated = await service.update(
        tenantId,
        id,
        pick<UpdateCustomerRequest>(body, ["phone", "fullName", "email"]),
      );
      await recordAudit(request, audit, {
        action: "customer.updated",
        objectType: "customer",
        objectId: id,
        before,
        after: updated,
      });
      return updated;
    },
  );
}

function pick<T>(body: Record<string, unknown>, keys: string[]): T {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in body) out[key] = body[key];
  }
  return out as T;
}
