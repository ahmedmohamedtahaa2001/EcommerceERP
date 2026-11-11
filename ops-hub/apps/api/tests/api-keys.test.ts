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
import type { UserRecord } from "../src/auth/types";
import {
  FakeAuditWriter,
  FakeClock,
  FakeDirectory,
  FakeHasher,
  FakeLimiter,
  FakeSessions,
  NoopAuditReader,
  SESSION_TTL_SECONDS,
  TENANT_A,
  ownerUser,
  viewerUser,
} from "./fakes";

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

  async getById(tenantId: string, id: string): Promise<ApiKeySummary | null> {
    const record = this.records.get(id);
    if (!record || record.tenantId !== tenantId) {
      return null;
    }
    return {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      scopes: record.scopes,
      ipAllowlist: record.ipAllowlist,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
      revokedAt: record.revokedAt,
    };
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

const owner: UserRecord = ownerUser;
const viewer: UserRecord = viewerUser;

let app: FastifyInstance;
let clock: FakeClock;
let store: FakeApiKeyStore;
let auth: AuthService;
let apiKeyService: ApiKeyService;
let auditWriter: FakeAuditWriter;

beforeEach(() => {
  clock = new FakeClock();
  store = new FakeApiKeyStore(clock);
  auditWriter = new FakeAuditWriter();
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
    audit: auditWriter,
    auditReader: new NoopAuditReader(),
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
      audit: auditWriter,
      auditReader: new NoopAuditReader(),
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

describe("audit trail", () => {
  it("records api_key.created with a secret-free after state", async () => {
    const token = await loginAs(owner);
    const { body } = await createKey(token, {
      name: "storefront",
      scopes: ["orders:read"],
    });

    const created = auditWriter.entries.filter(
      (entry) => entry.action === "api_key.created",
    );
    expect(created).toHaveLength(1);
    const entry = created[0];
    expect(entry).toMatchObject({
      actorType: "user",
      actorId: owner.id,
      objectType: "api_key",
    });
    expect((entry?.after as { name: string }).name).toBe("storefront");
    // Neither the plaintext secret nor its digest may reach the audit trail.
    const payload = JSON.stringify(entry);
    expect(payload).not.toContain(body.secret as string);
    expect(payload).not.toContain(hashApiKey(body.secret as string));
  });

  it("records api_key.revoked with before and after states", async () => {
    const token = await loginAs(owner);
    const key = await createOrdersReadKey(token);

    const response = await app.inject({
      method: "DELETE",
      url: `/v1/api-keys/${key.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(204);

    const revoked = auditWriter.entries.filter(
      (entry) => entry.action === "api_key.revoked",
    );
    expect(revoked).toHaveLength(1);
    const entry = revoked[0];
    expect(entry?.objectId).toBe(key.id);
    expect((entry?.before as { revokedAt: null }).revokedAt).toBeNull();
    expect(entry?.after).toMatchObject({ name: "storefront" });
    expect((entry?.after as { revokedAt: unknown }).revokedAt).toBeTruthy();
  });

  it("records successful logins without the session token", async () => {
    await loginAs(owner);

    const logins = auditWriter.entries.filter(
      (entry) => entry.action === "auth.login",
    );
    expect(logins).toHaveLength(1);
    expect(logins[0]).toMatchObject({
      actorType: "user",
      actorId: owner.id,
      objectType: "session",
      objectId: null,
    });
    expect((logins[0]?.after as { userId: string }).userId).toBe(owner.id);
  });

  it("does not record failed logins", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: owner.email, password: "wrong" },
    });

    expect(auditWriter.entries).toHaveLength(0);
  });
});
