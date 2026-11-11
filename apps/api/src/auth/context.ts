import { can, type Permission } from "@ops-hub/domain";
import type { FastifyRequest } from "fastify";

import { ApiKeyScopeError } from "../api-keys/errors";
import type { ApiKeyActor, ApiKeyPrincipal } from "../api-keys/types";
import { ForbiddenError, UnauthorizedError } from "./errors";
import type { AuthUser } from "./types";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthUser;
    currentApiKey?: ApiKeyPrincipal;
    principal?: Principal;
  }
}

/** The authenticated caller: a staff session or an API key principal. */
export type Principal =
  | { kind: "user"; user: AuthUser }
  | { kind: "apiKey"; apiKey: ApiKeyPrincipal };

export interface RequestAuthenticator {
  /** Resolves the caller from request headers; throws 401/403 on failure. */
  authenticate(request: FastifyRequest): Promise<Principal>;
}

/**
 * Fastify `preHandler` that authenticates the request (session bearer token
 * or API key via `X-API-Key` / `Bearer ohk_...`) and enforces one permission.
 * Staff callers need the permission through their role; API keys need it in
 * their scopes.
 */
export function requirePermission(
  authenticator: RequestAuthenticator,
  permission: Permission,
) {
  return async (request: FastifyRequest): Promise<void> => {
    const principal = await authenticator.authenticate(request);
    request.principal = principal;

    if (principal.kind === "user") {
      if (!can(principal.user.role, permission)) {
        throw new ForbiddenError(permission);
      }
      request.currentUser = principal.user;
      return;
    }

    if (!principal.apiKey.scopes.includes(permission)) {
      throw new ApiKeyScopeError(permission);
    }
    request.currentApiKey = principal.apiKey;
  };
}

/** The principal set by `requirePermission`; throws when it is absent. */
export function requirePrincipal(request: FastifyRequest): Principal {
  if (!request.principal) {
    throw new UnauthorizedError();
  }
  return request.principal;
}

/** Who acted, and within which tenant, for audit and scoping purposes. */
export function actorAndTenant(principal: Principal): {
  actor: ApiKeyActor;
  tenantId: string;
} {
  if (principal.kind === "apiKey") {
    return {
      actor: { kind: "apiKey", id: principal.apiKey.id },
      tenantId: principal.apiKey.tenantId,
    };
  }
  const user = principal.user;
  if (!user.tenantId) {
    throw new ForbiddenError("tenant membership");
  }
  return { actor: { kind: "user", id: user.id }, tenantId: user.tenantId };
}
