import { permissionsFor, type Role } from "@ops-hub/domain";
import type { FastifyInstance } from "fastify";

import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { UnauthorizedError, ValidationError } from "./errors";
import { bearerToken } from "./http";
import type { AuthService } from "./service";

/** The client uses this list to show only the modules a person may use. */
function withPermissions<T extends { role: Role | null }>(
  user: T,
): T & { permissions: string[] } {
  return { ...user, permissions: permissionsFor(user.role) };
}

export function registerAuthRoutes(
  app: FastifyInstance,
  service: AuthService,
  audit?: AuditWriter,
): void {
  app.post("/v1/auth/login", async (request, reply) => {
    const body = request.body;
    if (typeof body !== "object" || body === null) {
      throw new ValidationError("email and password are required.");
    }

    const { email, password } = body as {
      email?: unknown;
      password?: unknown;
    };
    if (
      typeof email !== "string" ||
      email.trim() === "" ||
      typeof password !== "string" ||
      password === ""
    ) {
      throw new ValidationError("email and password are required.");
    }

    const result = await service.login(email, password);
    reply.header("cache-control", "no-store");

    if (audit && result.user.tenantId) {
      await recordAudit(
        request,
        audit,
        {
          action: "auth.login",
          objectType: "session",
          objectId: null,
          after: { userId: result.user.id, email: result.user.email },
        },
        {
          tenantId: result.user.tenantId,
          actorType: "user",
          actorId: result.user.id,
        },
      );
    }

    return {
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
      user: withPermissions(result.user),
    };
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const token = bearerToken(request);
    if (token) {
      await service.logout(token);
    }
    reply.status(204);
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const token = bearerToken(request);
    if (!token) {
      throw new UnauthorizedError();
    }

    const user = await service.authenticate(token);
    reply.header("cache-control", "no-store");
    return { user: withPermissions(user) };
  });
}
