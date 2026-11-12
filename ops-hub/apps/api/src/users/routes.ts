import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { UserValidationError } from "./errors";
import type { UserAdminService } from "./service";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new UserValidationError("A JSON object body is required.");
  }
  return body as Record<string, unknown>;
}

export function registerUserRoutes(
  app: FastifyInstance,
  options: {
    service: UserAdminService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.get(
    "/v1/users",
    { preHandler: requirePermission(requestAuth, "users:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return { members: await service.list(tenantId) };
    },
  );

  app.post(
    "/v1/users",
    { preHandler: requirePermission(requestAuth, "users:write") },
    async (request, reply) => {
      const body = asObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const member = await service.invite(tenantId, {
        email: body.email,
        fullName: body.fullName,
        role: body.role,
        password: body.password,
      });
      await recordAudit(request, audit, {
        action: "user.invited",
        objectType: "membership",
        objectId: member.id,
        after: { email: member.email, role: member.role },
      });
      reply.status(201);
      return member;
    },
  );

  app.patch(
    "/v1/users/:id",
    { preHandler: requirePermission(requestAuth, "users:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = asObject(request.body);
      const { actor, tenantId } = actorAndTenant(requirePrincipal(request));
      const { before, after } = await service.update(tenantId, actor.id, id, {
        role: body.role,
        active: body.active,
      });
      if (before.role !== after.role || before.active !== after.active) {
        await recordAudit(request, audit, {
          action: "user.updated",
          objectType: "membership",
          objectId: id,
          before: { role: before.role, active: before.active },
          after: { role: after.role, active: after.active },
        });
      }
      return after;
    },
  );
}
