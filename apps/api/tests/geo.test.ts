import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { resolveGovernorate } from "@ops-hub/shared";
import { AuthService } from "../src/auth/service";
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
  ownerUser,
  viewerUser,
} from "./fakes";

const owner: UserRecord = ownerUser;
const viewer: UserRecord = viewerUser;

let app: FastifyInstance;
let clock: FakeClock;
let auth: AuthService;
let auditWriter: FakeAuditWriter;

beforeEach(() => {
  clock = new FakeClock();
  auditWriter = new FakeAuditWriter();
  auth = new AuthService({
    users: new FakeDirectory([owner, viewer]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: new FakeLimiter(),
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });
  app = buildApp({
    logger: false,
    auth,
    audit: auditWriter,
    auditReader: new NoopAuditReader(),
  });
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

describe("resolveGovernorate", () => {
  it("resolves spelling variants", () => {
    expect(resolveGovernorate("gizeh")).toBe("GIZ");
    expect(resolveGovernorate("الجيزة")).toBe("GIZ");
    expect(resolveGovernorate("Giza")).toBe("GIZ");
    expect(resolveGovernorate("cairo")).toBe("CAI");
    expect(resolveGovernorate("gizeh ")).toBe("GIZ");
    expect(resolveGovernorate("unknown-place")).toBeNull();
    expect(resolveGovernorate("")).toBeNull();
  });
});

describe("GET /v1/geo/governorates", () => {
  it("returns governorates", async () => {
    const token = await loginAs(owner);
    const res = await app.inject({
      method: "GET",
      url: "/v1/geo/governorates",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ governorates: { code: string }[] }>();
    expect(body.governorates.length).toBeGreaterThan(20);
    expect(body.governorates.some((g) => g.code === "GIZ")).toBe(true);
  });
});

describe("GET /v1/geo/districts", () => {
  it("filters by governorate", async () => {
    const token = await loginAs(owner);
    const res = await app.inject({
      method: "GET",
      url: "/v1/geo/districts?governorate=gizeh",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ districts: { governorateCode: string }[] }>();
    expect(body.districts.length).toBeGreaterThan(0);
    expect(body.districts.every((d) => d.governorateCode === "GIZ")).toBe(true);
  });

  it("returns all districts when no filter", async () => {
    const token = await loginAs(owner);
    const res = await app.inject({
      method: "GET",
      url: "/v1/geo/districts",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ districts: unknown[] }>().districts.length).toBeGreaterThan(0);
  });
});

describe("GET /v1/geo/resolve", () => {
  it("resolves a governorate", async () => {
    const token = await loginAs(owner);
    const res = await app.inject({
      method: "GET",
      url: "/v1/geo/resolve?q=Gizeh",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ governorateCode: string }>().governorateCode).toBe("GIZ");
  });
});
