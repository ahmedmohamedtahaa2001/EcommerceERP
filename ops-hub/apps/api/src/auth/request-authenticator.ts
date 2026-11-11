import type { FastifyRequest } from "fastify";

import { InvalidApiKeyError } from "../api-keys/errors";
import { isApiKeySecret } from "../api-keys/keys";
import type { ApiKeyService } from "../api-keys/service";
import type { Principal, RequestAuthenticator } from "./context";
import { UnauthorizedError } from "./errors";
import { bearerToken } from "./http";
import type { AuthService } from "./service";

/**
 * Client IP for allow-list checks. When a reverse proxy is in front of the
 * API, the deployment must only expose this endpoint behind a proxy that
 * overwrites (not appends to) `X-Forwarded-For`; otherwise a caller could
 * spoof its IP.
 */
export function clientIp(request: FastifyRequest): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.socket.remoteAddress ?? null;
}

function headerString(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" && first !== "" ? first : null;
  }
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Authenticates a request from either channel:
 * - `X-API-Key` header or a `Bearer ohk_...` token → API key scopes;
 * - any other bearer token → staff session.
 */
export class CompositeRequestAuthenticator implements RequestAuthenticator {
  constructor(
    private readonly auth?: AuthService,
    private readonly apiKeys?: ApiKeyService,
  ) {}

  async authenticate(request: FastifyRequest): Promise<Principal> {
    const headerKey = headerString(request.headers["x-api-key"]);
    if (headerKey) {
      return this.authenticateApiKey(headerKey, clientIp(request));
    }

    const token = bearerToken(request);
    if (!token) {
      throw new UnauthorizedError();
    }

    if (isApiKeySecret(token)) {
      return this.authenticateApiKey(token, clientIp(request));
    }

    if (!this.auth) {
      throw new UnauthorizedError();
    }
    return { kind: "user", user: await this.auth.authenticate(token) };
  }

  private async authenticateApiKey(
    secret: string,
    ip: string | null,
  ): Promise<Principal> {
    if (!this.apiKeys) {
      throw new InvalidApiKeyError();
    }
    const apiKey = await this.apiKeys.authenticate(secret, ip);
    return { kind: "apiKey", apiKey };
  }
}
