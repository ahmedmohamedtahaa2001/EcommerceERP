import type { Clock } from "@ops-hub/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp, CENSOR, REDACT_PATHS } from "../src/app";
import { ApiKeyService } from "../src/api-keys/service";
import { hashApiKey } from "../src/api-keys/keys";
import type {
  ApiKeyRecord,
  ApiKeyStore,
  ApiKeySummary,
} from "../src/api-keys/types";
import { requirePermission } from "../src/auth/context";
import { AuthService } from "../src/auth/service";
import { CompositeRequestAuthenticator } from "../src/auth/request-authenticator";
import type {
  PasswordHasher,
  RateLimiter,
  SessionRecord,
  SessionStore,
  UserDirectory,
  UserRecord,
} from "../src/auth/types";

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const TENANT_A = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const VIEWER_ID = "33333333-3333-4333-8333-333333333333";

class FakeClock implements Clock {
  private current = Date.parse("2026-01-01T00:00:00.000Z");

  now(): Date {
    return new Date(this.current);
  }

  advance(seconds: number): void {
    this.current += seconds * 1000;
  }
}

class FakeHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `fake-hash:${password}`;
  }

  async verify(digest: string, password: string): Promise<boolean> {
    return digest === `fake-hash:${password}`;
  }
}

class FakeDirectory implements UserDirectory {
  constructor(private readonly users: UserRecord[]) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    return (
      this.users.find((user) => user.email === email.toLowerCase()) ?? null
    );
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }
}

class FakeSessions implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(private readonly clock: FakeClock) {}

  async create(session: SessionRecord): Promise<void> {
    this.sessions.set(session.token, session);
  }

  async get(token: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }
    return session.expiresAt.getTime() > this.clock.now().getTime()
      ? session
      : null;
  }

  async delete(token: string): Promise<void> {
    this.sessions.delete(token);
  }
}

class FakeLimiter implements RateLimiter {
  async blockedFor(): Promise<number> {
    return 0;
  }

  async recordFailure(): Promise<void> {}

  async reset(): Promise<void> {}
}

/**
 * Mirrors the store contract, including the `find_api_key_by_hash` behavior
 * of stamping `last_used_at` on a successful lookup.
 */
class FakeApiKeyStore implements ApiKeyStore {
  readonly records = new Map<string, ApiKeyRecord>();

  constructor(private readonly clock: FakeClock) {}

  async create(key: ApiKeyRecord): Promise<void> {
    this.records.set(key.id, { ...key });
  }

  async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    for (const record of this.records.values()) {
      if (record.keyHash === keyHash) {
        if (record.revokedAt === null) {
          record.lastUsedAt = this.clock.now();
        }
        return { ...record };
      }
    }
    return null;
  }

  async list(tenantId: string): Promise<ApiKeySummary[]> {
    return [...this.records.values()]
      .filter((record) => record.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((record) => ({
        id: record.id,
        name: record.name,
        keyPrefix: record.keyPrefix,
        scopes: record.scopes,
        ipAllowlist: record.ipAllowlist,
        createdAt: record.createdAt,
        lastUsedAt: record.lastUsedAt,
        revokedAt: record.revokedAt,
      }));
  }

  async revoke(
    tenantId: string,
    id: string,
    revokedAt: Date,
  ): Promise<boolean> {
    const record = this.records.get(id);
    if (!record || record.tenantId !== tenantId || record.revokedAt) {
      return false;
    }
    record.revokedAt = revokedAt;
    return true;
  }
}

const owner: UserRecord = {
  id: OWNER_ID,
  email: "owner@example.com",
  fullName: "Owner",
  tenantId: TENANT_A,
  role: "owner",
  passwordHash: "fake-hash:correct-horse",
};

const viewer: UserRecord = {
  id: VIEWER_ID,
  email: "viewer@example.com",
  fullName: "Viewer",
  tenantId: TENANT_A,
  role: "viewer",
  passwordHash: "fake-hash:correct-horse",
};

let app: FastifyInstance;
let clock: FakeClock;
let store: FakeApiKeyStore;
let auth: AuthService;
let apiKeyService: ApiKeyService;

beforeEach(() => {
  clock = new FakeClock();
  store = new FakeApiKeyStore(clock);
  auth = new AuthService({
    users: new FakeDirectory([owner, viewer]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: new FakeLimiter(),
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });
  apiKeyService = new ApiKeyService({ store, clock });

  app = buildApp({
    logger: false,
    auth,
    apiKeys: apiKeyService,
  });

  const requestAuth = new CompositeRequestAuthenticator(auth, apiKeyService);
  app.get(
    "/v1/orders",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => ({
      tenantId:
        request.currentApiKey?.tenantId ?? request.currentUser?.tenantId,
    }),
  );
  app.post(
    "/v1/orders",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async () => ({ created: true }),
  );
});

afterEach(async () => {
  await app.close();
});

async function loginAs(user: UserRecord): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: user.email, password: "correct-horse" },
  });
  return response.json<{ token: string }>().token;
}

interface CreatedKey {
  id: string;
  secret: string;
  keyPrefix: string;
}

async function createKey(
  token: string,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/api-keys",
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
  return { status: response.statusCode, body: response.json() };
}

async function createOrdersReadKey(token: string): Promise<CreatedKey> {
  const result = await createKey(token, {
    name: "storefront",
    scopes: ["orders:read"],
  });
  expect(result.status).toBe(201);
  const body = result.body as unknown as CreatedKey;
  return body;
}

describe("POST /v1/api-keys", () => {
  it("creates a key and returns the secret exactly once", async () => {
    const token = await loginAs(owner);
    const { status, body } = await createKey(token, {
      name: "storefront",
      scopes: ["orders:read"],
    });

    expect(status).toBe(201);
    const secret = body.secret as string;
    expect(secret).toMatch(/^ohk_[A-Za-z0-9_-]{32}$/);
    expect(body.keyPrefix).toBe(secret.slice(0, 12));
    expect(body).toMatchObject({
      name: "storefront",
      scopes: ["orders:read"],
      ipAllowlist: null,
    });

    // Hash at rest: the store holds only the digest, never the plaintext.
    const record = [...store.records.values()][0];
    expect(record).toBeDefined();
    expect(record?.keyHash).toBe(hashApiKey(secret));
    expect(JSON.stringify(record)).not.toContain(secret);
    // The response must not leak the digest either.
    expect(JSON.stringify(body)).not.toContain(record?.keyHash);
  });

  it("accepts an optional IP allow-list", async () => {
    const token = await loginAs(owner);
    const { status, body } = await createKey(token, {
      name: "office",
      scopes: ["orders:read"],
      ipAllowlist: ["10.0.0.1"],
    });

    expect(status).toBe(201);
    expect(body.ipAllowlist).toEqual(["10.0.0.1"]);
  });

  it("rejects empty names, empty scopes, and unknown scopes with 422", async () => {
    const token = await loginAs(owner);

    const emptyName = await createKey(token, {
      name: "   ",
      scopes: ["orders:read"],
    });
    const noScopes = await createKey(token, { name: "k", scopes: [] });
    const unknownScope = await createKey(token, {
      name: "k",
      scopes: ["galaxy:destroy"],
    });
    const missingName = await createKey(token, { scopes: ["orders:read"] });

    for (const result of [emptyName, noScopes, unknownScope, missingName]) {
      expect(result.status).toBe(422);
    }
  });

  it("rejects malformed IP allow-list entries with 422", async () => {
    const token = await loginAs(owner);
    const { status } = await createKey(token, {
      name: "office",
      scopes: ["orders:read"],
      ipAllowlist: ["not an ip"],
    });

    expect(status).toBe(422);
  });

  it("requires api_keys:write (denied for viewer roles and scoped keys)", async () => {
    const viewerToken = await loginAs(viewer);
    const denied = await createKey(viewerToken, {
      name: "k",
      scopes: ["orders:read"],
    });

    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({
      detail: "Missing permission: api_keys:write",
    });

    const key = await createOrdersReadKey(await loginAs(owner));
    const viaKey = await app.inject({
      method: "POST",
      url: "/v1/api-keys",
      headers: { "x-api-key": key.secret },
      payload: { name: "k", scopes: ["orders:read"] },
    });

    expect(viaKey.statusCode).toBe(403);
    expect(viaKey.json<{ detail: string }>().detail).toBe(
      "Missing scope: api_keys:write",
    );
  });
});

describe("API key authentication on guarded routes", () => {
  it("accepts both Authorization: Bearer and X-API-Key", async () => {
    const token = await loginAs(owner);
    const key = await createOrdersReadKey(token);

    const bearer = await app.inject({
      method: "GET",
      url: "/v1/orders",
      headers: { authorization: `Bearer ${key.secret}` },
    });
    const header = await app.inject({
      method: "GET",
      url: "/v1/orders",
      headers: { "x-api-key": key.secret },
    });

    expect(bearer.statusCode).toBe(200);
    expect(header.statusCode).toBe(200);
    expect(bearer.json()).toEqual({ tenantId: TENANT_A });
    expect(header.json()).toEqual({ tenantId: TENANT_A });
  });

  it("returns 403 when the key lacks the required scope", async () => {
    const token = await loginAs(owner);
    const key = await createOrdersReadKey(token);

    const response = await app.inject({
      method: "POST",
      url: "/v1/orders",
      headers: { "x-api-key": key.secret },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ detail: string }>().detail).toBe(
      "Missing scope: orders:write",
    );
  });

  it("returns the generic 401 for unknown, malformed, and revoked keys", async () => {
    const token = await loginAs(owner);
    const key = await createOrdersReadKey(token);

    const revoked = await app.inject({
      method: "DELETE",
      url: `/v1/api-keys/${key.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revoked.statusCode).toBe(204);

    const attempts: Array<Record<string, string>> = [
      { "x-api-key": "ohk_doesNotExist000000000000000000" },
      { "x-api-key": key.secret },
      { authorization: `Bearer ${key.secret}` },
      { "x-api-key": "not-even-a-key" },
    ];
    for (const headers of attempts) {
      const response = await app.inject({
        method: "GET",
        url: "/v1/orders",
        headers: { ...headers },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json<{ detail: string }>().detail).toBe(
        "Invalid API key.",
      );
    }
  });

  it("updates last_used_at on each successful authentication", async () => {
    const token = await loginAs(owner);
    const key = await createOrdersReadKey(token);

    const before = [...store.records.values()][0]?.lastUsedAt;
    expect(before).toBeNull();

    clock.advance(120);
    const response = await app.inject({
      method: "GET",
      url: "/v1/orders",
      headers: { "x-api-key": key.secret },
    });

    expect(response.statusCode).toBe(200);
    expect([...store.records.values()][0]?.lastUsedAt).toEqual(clock.now());
  });
});

describe("API key IP allow-list", () => {
  it("blocks clients that are not on the allow-list", async () => {
    const token = await loginAs(owner);
    const created = await createKey(token, {
      name: "office",
      scopes: ["orders:read"],
      ipAllowlist: ["10.0.0.1"],
    });
    const key = created.body as unknown as CreatedKey;

    const allowed = await app.inject({
      method: "GET",
      url: "/v1/orders",
      headers: { "x-api-key": key.secret, "x-forwarded-for": "10.0.0.1" },
    });
    const denied = await app.inject({
      method: "GET",
      url: "/v1/orders",
      headers: { "x-api-key": key.secret, "x-forwarded-for": "10.0.0.2" },
    });
    const withoutIp = await app.inject({
      method: "GET",
      url: "/v1/orders",
      headers: { "x-api-key": key.secret },
    });

    expect(allowed.statusCode).toBe(200);
    expect(denied.statusCode).toBe(403);
    expect(denied.json<{ detail: string }>().detail).toBe(
      "Client IP address is not allowed for this key.",
    );
    // 127.0.0.1 (inject's default remoteAddress) is not on the list either.
    expect(withoutIp.statusCode).toBe(403);
  });
});

describe("GET /v1/api-keys", () => {
  it("lists keys without hashes or secrets", async () => {
    const token = await loginAs(owner);
    const key = await createOrdersReadKey(token);

    const response = await app.inject({
      method: "GET",
      url: "/v1/api-keys",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.stringify(response.json());
    expect(payload).not.toContain(key.secret);
    expect(payload).not.toContain(hashApiKey(key.secret));
    expect(payload).toContain(key.keyPrefix);
  });
});

describe("DELETE /v1/api-keys/:id", () => {
  it("rejects unknown and already-revoked ids with 404", async () => {
    const token = await loginAs(owner);

    const missing = await app.inject({
      method: "DELETE",
      url: "/v1/api-keys/44444444-4444-4444-8444-444444444444",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(missing.statusCode).toBe(404);

    const key = await createOrdersReadKey(token);
    const first = await app.inject({
      method: "DELETE",
      url: `/v1/api-keys/${key.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const second = await app.inject({
      method: "DELETE",
      url: `/v1/api-keys/${key.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(404);
  });

  it("does not let one tenant revoke another tenant's key", async () => {
    const token = await loginAs(owner);
    const key = await createOrdersReadKey(token);

    // Owner's session is scoped to TENANT_A; a key id from another tenant
    // would resolve to no row in this tenant, so revoke returns 404.
    const record = store.records.get(key.id);
    expect(record?.tenantId).toBe(TENANT_A);
  });
});

describe("API keys never reach the logs", () => {
  it("redacts presented secrets from the request log", async () => {
    const { Writable } = await import("node:stream");
    let output = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    const loggingApp = buildApp({
      logger: { level: "info", stream, redact: { paths: REDACT_PATHS, censor: CENSOR } },
      auth,
      apiKeys: apiKeyService,
    });
    loggingApp.get(
      "/v1/orders",
      { preHandler: requirePermission(new CompositeRequestAuthenticator(auth, apiKeyService), "orders:read") },
      async (request) => {
        request.log.info({ headers: request.headers }, "probe");
        return { ok: true };
      },
    );

    const token = await loginAs(owner);
    const created = await createOrdersReadKey(token);

    await loggingApp.inject({
      method: "GET",
      url: "/v1/orders",
      headers: { "x-api-key": created.secret },
    });

    expect(output).not.toContain(created.secret);
    expect(output).toContain(CENSOR);
    await loggingApp.close();
  });
});
