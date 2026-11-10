import type { Clock } from "@ops-hub/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { AuthService } from "../src/auth/service";
import type {
  AuthUser,
  PasswordHasher,
  RateLimiter,
  SessionRecord,
  SessionStore,
  UserDirectory,
  UserRecord,
} from "../src/auth/types";

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const LIMIT = 5;
const WINDOW_SECONDS = 15 * 60;

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
  private readonly attempts = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(private readonly clock: FakeClock) {}

  async blockedFor(identifier: string): Promise<number> {
    const entry = this.attempts.get(identifier);
    const now = this.clock.now().getTime();
    if (!entry || entry.resetAt <= now) {
      return 0;
    }
    return entry.count >= LIMIT
      ? Math.ceil((entry.resetAt - now) / 1000)
      : 0;
  }

  async recordFailure(identifier: string): Promise<void> {
    const now = this.clock.now().getTime();
    const entry = this.attempts.get(identifier);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(identifier, {
        count: 1,
        resetAt: now + WINDOW_SECONDS * 1000,
      });
      return;
    }
    entry.count += 1;
  }

  async reset(identifier: string): Promise<void> {
    this.attempts.delete(identifier);
  }
}

const user: UserRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.com",
  fullName: "Owner",
  tenantId: "22222222-2222-4222-8222-222222222222",
  passwordHash: "fake-hash:correct-horse",
};

let app: FastifyInstance;
let clock: FakeClock;

beforeEach(() => {
  clock = new FakeClock();
  const auth = new AuthService({
    users: new FakeDirectory([user]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: new FakeLimiter(clock),
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
    for (let attempt = 0; attempt < LIMIT; attempt += 1) {
      const response = await login({ email: user.email, password: "wrong" });
      expect(response.statusCode).toBe(401);
    }

    const blocked = await login({
      email: user.email,
      password: "correct-horse",
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["retry-after"]).toBe(String(WINDOW_SECONDS));

    clock.advance(WINDOW_SECONDS + 1);
    const allowedAgain = await login({
      email: user.email,
      password: "correct-horse",
    });

    expect(allowedAgain.statusCode).toBe(200);
  });
});
