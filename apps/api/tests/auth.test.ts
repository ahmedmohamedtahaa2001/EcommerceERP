import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { AuthService } from "../src/auth/service";
import type { AuthUser } from "../src/auth/types";
import {
  FakeClock,
  FakeDirectory,
  FakeHasher,
  FakeLoginLimiter,
  FakeSessions,
  LOGIN_ATTEMPT_LIMIT,
  LOGIN_WINDOW_SECONDS,
  SESSION_TTL_SECONDS,
  ownerUser as user,
} from "./fakes";

let app: FastifyInstance;
let clock: FakeClock;
let limiter: FakeLoginLimiter;

beforeEach(() => {
  clock = new FakeClock();
  limiter = new FakeLoginLimiter(clock);
  const auth = new AuthService({
    users: new FakeDirectory([user]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter,
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });
  app = buildApp({ logger: false, auth });
});

afterEach(async () => {
  await app.close();
});

function login(payload: Record<string, unknown>) {
  return app.inject({ method: "POST", url: "/v1/auth/login", payload });
}

async function loginAsOwner(): Promise<string> {
  const response = await login({
    email: "Owner@Example.com",
    password: "correct-horse",
  });
  return response.json<{ token: string }>().token;
}

describe("POST /v1/auth/login", () => {
  it("returns a session token and a public user without the password hash", async () => {
    const response = await login({
      email: "Owner@Example.com",
      password: "correct-horse",
    });
    const body = response.json<{ token: string; user: AuthUser }>();

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(body.token).toBeTruthy();
    expect(body.user).toMatchObject({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain("fake-hash");
  });

  it("returns the same generic error for a wrong password and an unknown email", async () => {
    const wrongPassword = await login({
      email: user.email,
      password: "wrong",
    });
    const unknownEmail = await login({
      email: "nobody@example.com",
      password: "wrong",
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json<{ detail: string }>().detail).toBe(
      "Invalid email or password.",
    );
    expect(unknownEmail.json<{ detail: string }>().detail).toBe(
      "Invalid email or password.",
    );
  });

  it("rejects missing credentials with 422", async () => {
    const response = await login({ email: user.email });

    expect(response.statusCode).toBe(422);
  });
});

describe("GET /v1/auth/me", () => {
  it("returns the authenticated user", async () => {
    const token = await loginAsOwner();
    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ user: AuthUser }>().user.email).toBe(user.email);
  });

  it("rejects missing and unknown tokens", async () => {
    const missing = await app.inject({ method: "GET", url: "/v1/auth/me" });
    const unknown = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: "Bearer not-a-session" },
    });

    expect(missing.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
  });

  it("expires the session after the TTL", async () => {
    const token = await loginAsOwner();
    clock.advance(SESSION_TTL_SECONDS + 1);

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("POST /v1/auth/logout", () => {
  it("invalidates the session", async () => {
    const token = await loginAsOwner();

    const logout = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { authorization: `Bearer ${token}` },
    });
    const me = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(logout.statusCode).toBe(204);
    expect(me.statusCode).toBe(401);
  });
});

describe("login rate limiting", () => {
  it("blocks the sixth attempt for the rest of the window", async () => {
    for (let attempt = 0; attempt < LOGIN_ATTEMPT_LIMIT; attempt += 1) {
      const response = await login({ email: user.email, password: "wrong" });
      expect(response.statusCode).toBe(401);
    }

    const blocked = await login({
      email: user.email,
      password: "correct-horse",
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["retry-after"]).toBe(String(LOGIN_WINDOW_SECONDS));

    clock.advance(LOGIN_WINDOW_SECONDS + 1);
    const allowedAgain = await login({
      email: user.email,
      password: "correct-horse",
    });

    expect(allowedAgain.statusCode).toBe(200);
  });
});
