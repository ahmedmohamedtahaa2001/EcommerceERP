import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { AuthService } from "../src/auth/service";
import {
  FakeClock,
  FakeDirectory,
  FakeHasher,
  FakeSessions,
  SESSION_TTL_SECONDS,
  ownerUser,
} from "./fakes";

let app: FastifyInstance;

beforeEach(() => {
  const clock = new FakeClock();
  const auth = new AuthService({
    users: new FakeDirectory([ownerUser]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: {
      blockedFor: async () => 0,
      recordFailure: async () => {},
      reset: async () => {},
    },
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });
  app = buildApp({ logger: false, auth });
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

describe("GET /v1/geo/governorates", () => {
  it("returns all 27 governorates with codes", async () => {
    const token = await loginAs(ownerUser);
    const response = await app.inject({
      method: "GET",
      url: "/v1/geo/governorates",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ governorates: Array<{ code: string }> }>();
    expect(body.governorates).toHaveLength(27);
    expect(body.governorates.map((g) => g.code)).toContain("GIZ");
  });

  it("requires authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/geo/governorates",
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("GET /v1/geo/districts", () => {
  it("returns districts, optionally filtered by governorate", async () => {
    const token = await loginAs(ownerUser);
    const all = await app.inject({
      method: "GET",
      url: "/v1/geo/districts",
      headers: { authorization: `Bearer ${token}` },
    });
    const filtered = await app.inject({
      method: "GET",
      url: "/v1/geo/districts",
      headers: { authorization: `Bearer ${token}` },
      query: { governorateCode: "GIZ" },
    });

    expect(all.statusCode).toBe(200);
    expect(filtered.statusCode).toBe(200);
    const filteredBody = filtered.json<{
      districts: Array<{ governorateCode: string }>;
    }>();
    expect(filteredBody.districts.length).toBeGreaterThan(0);
    expect(
      filteredBody.districts.every((d) => d.governorateCode === "GIZ"),
    ).toBe(true);
  });
});
