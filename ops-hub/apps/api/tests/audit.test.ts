import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import type {
  AuditEntryRecord,
  AuditQuery,
  AuditReader,
} from "../src/audit/types";
import { AuthService } from "../src/auth/service";
import {
  FakeAuditWriter,
  FakeClock,
  FakeDirectory,
  FakeHasher,
  FakeSessions,
  SESSION_TTL_SECONDS,
  TENANT_A,
  ownerUser,
  viewerUser,
} from "./fakes";

class RecordingAuditReader implements AuditReader {
  readonly queries: AuditQuery[] = [];

  constructor(private readonly entries: AuditEntryRecord[]) {}

  async list(
    tenantId: string,
    query: AuditQuery,
  ): Promise<AuditEntryRecord[]> {
    expect(tenantId).toBe(TENANT_A);
    this.queries.push(query);
    return this.entries;
  }
}

const entry: AuditEntryRecord = {
  id: 1,
  tenantId: TENANT_A,
  actorType: "user",
  actorId: ownerUser.id,
  action: "api_key.created",
  objectType: "api_key",
  objectId: "62004954-0d13-43ba-ae21-cb8bb42c7f21",
  before: null,
  after: { name: "storefront" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

let app: FastifyInstance;
let reader: RecordingAuditReader;

beforeEach(() => {
  const clock = new FakeClock();
  reader = new RecordingAuditReader([entry]);
  const auth = new AuthService({
    users: new FakeDirectory([ownerUser, viewerUser]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: { blockedFor: async () => 0, recordFailure: async () => {}, reset: async () => {} },
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });

  app = buildApp({
    logger: false,
    auth,
    audit: new FakeAuditWriter(),
    auditReader: reader,
  });
});

afterEach(async () => {
  await app.close();
});

async function loginAs(user: typeof ownerUser): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: user.email, password: "correct-horse" },
  });
  return response.json<{ token: string }>().token;
}

describe("GET /v1/audit", () => {
  it("returns entries for callers with audit:read", async () => {
    const token = await loginAs(ownerUser);
    const response = await app.inject({
      method: "GET",
      url: "/v1/audit",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ entries: AuditEntryRecord[] }>();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toMatchObject({
      id: entry.id,
      action: entry.action,
      objectType: entry.objectType,
      objectId: entry.objectId,
      after: entry.after,
    });
  });

  it("denies roles without audit:read", async () => {
    const token = await loginAs(viewerUser);
    const response = await app.inject({
      method: "GET",
      url: "/v1/audit",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it("requires authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/audit" });
    expect(response.statusCode).toBe(401);
  });

  it("maps ?object=api_key:<id> to type and id filters", async () => {
    const token = await loginAs(ownerUser);
    const response = await app.inject({
      method: "GET",
      url: "/v1/audit",
      headers: { authorization: `Bearer ${token}` },
      query: { object: "api_key:62004954-0d13-43ba-ae21-cb8bb42c7f21" },
    });

    expect(response.statusCode).toBe(200);
    expect(reader.queries[0]).toEqual({
      objectType: "api_key",
      objectId: "62004954-0d13-43ba-ae21-cb8bb42c7f21",
      limit: 50,
    });
  });

  it("accepts a type-only object filter and a clamped limit", async () => {
    const token = await loginAs(ownerUser);
    const response = await app.inject({
      method: "GET",
      url: "/v1/audit",
      headers: { authorization: `Bearer ${token}` },
      query: { object: "api_key", limit: "5" },
    });

    expect(response.statusCode).toBe(200);
    expect(reader.queries[0]).toMatchObject({
      objectType: "api_key",
      limit: 5,
    });
  });

  it("rejects invalid limits with 422", async () => {
    const token = await loginAs(ownerUser);

    const notANumber = await app.inject({
      method: "GET",
      url: "/v1/audit",
      headers: { authorization: `Bearer ${token}` },
      query: { limit: "many" },
    });
    const tooLarge = await app.inject({
      method: "GET",
      url: "/v1/audit",
      headers: { authorization: `Bearer ${token}` },
      query: { limit: "201" },
    });

    expect(notANumber.statusCode).toBe(422);
    expect(tooLarge.statusCode).toBe(422);
  });
});
