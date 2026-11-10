import { can, type Permission } from "@ops-hub/domain";
import type { FastifyRequest } from "fastify";

import { ForbiddenError, UnauthorizedError } from "./errors";
import { bearerToken } from "./http";
import type { AuthUser } from "./types";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthUser;
  }
}

export interface Authenticator {
  authenticate(token: string): Promise<AuthUser>;
}

/**
 * Fastify `preHandler` that authenticates the bearer session and enforces one
 * permission. Handlers behind it can read `request.currentUser`.
 */
export function requirePermission(
  authenticator: Authenticator,
  permission: Permission,
) {
  return async (request: FastifyRequest): Promise<void> => {
    const token = bearerToken(request);
    if (!token) {
      throw new UnauthorizedError();
    }

    const user = await authenticator.authenticate(token);
    if (!can(user.role, permission)) {
      throw new ForbiddenError(permission);
    }

    request.currentUser = user;
  };
}
