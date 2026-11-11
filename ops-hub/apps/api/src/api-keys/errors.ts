import { AuthError } from "../auth/errors";

export class InvalidApiKeyError extends AuthError {
  constructor() {
    // One generic message for unknown, malformed, and revoked keys so the
    // response leaks nothing about which keys exist.
    super("invalid-api-key", "Invalid API key.", 401);
  }
}

export class ApiKeyScopeError extends AuthError {
  constructor(scope: string) {
    super("missing-scope", `Missing scope: ${scope}`, 403);
  }
}

export class ApiKeyIpDeniedError extends AuthError {
  constructor() {
    super("ip-not-allowed", "Client IP address is not allowed for this key.", 403);
  }
}

export class ApiKeyNotFoundError extends AuthError {
  constructor() {
    super("api-key-not-found", "API key not found.", 404);
  }
}
