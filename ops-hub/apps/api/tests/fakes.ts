import type { Clock } from "@ops-hub/shared";

import type {
  AuditEntryInput,
  AuditEntryRecord,
  AuditReader,
} from "../src/audit/types";
import type {
  PasswordHasher,
  RateLimiter,
  SessionRecord,
  SessionStore,
  UserDirectory,
  UserRecord,
} from "../src/auth/types";

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const LOGIN_ATTEMPT_LIMIT = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;

export const TENANT_A = "22222222-2222-4222-8222-222222222222";
export const OWNER_ID = "11111111-1111-4111-8111-111111111111";
export const VIEWER_ID = "33333333-3333-4333-8333-333333333333";

export class FakeClock implements Clock {
  private current = Date.parse("2026-01-01T00:00:00.000Z");

  now(): Date {
    return new Date(this.current);
  }

  advance(seconds: number): void {
    this.current += seconds * 1000;
  }
}

export class FakeHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `fake-hash:${password}`;
  }

  async verify(digest: string, password: string): Promise<boolean> {
    return digest === `fake-hash:${password}`;
  }
}

export class FakeDirectory implements UserDirectory {
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

export class FakeSessions implements SessionStore {
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

/** Rate limiter with the real blocking behavior, used by auth tests. */
export class FakeLoginLimiter implements RateLimiter {
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
    return entry.count >= LOGIN_ATTEMPT_LIMIT
      ? Math.ceil((entry.resetAt - now) / 1000)
      : 0;
  }

  async recordFailure(identifier: string): Promise<void> {
    const now = this.clock.now().getTime();
    const entry = this.attempts.get(identifier);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(identifier, {
        count: 1,
        resetAt: now + LOGIN_WINDOW_SECONDS * 1000,
      });
      return;
    }
    entry.count += 1;
  }

  async reset(identifier: string): Promise<void> {
    this.attempts.delete(identifier);
  }
}

/** No-op limiter for tests that never exercise the blocking path. */
export class FakeLimiter implements RateLimiter {
  async blockedFor(): Promise<number> {
    return 0;
  }

  async recordFailure(): Promise<void> {}

  async reset(): Promise<void> {}
}

export class FakeAuditWriter {
  readonly entries: AuditEntryInput[] = [];

  async record(entry: AuditEntryInput): Promise<void> {
    this.entries.push(entry);
  }
}

export class NoopAuditReader implements AuditReader {
  async list(): Promise<AuditEntryRecord[]> {
    return [];
  }
}

export const ownerUser: UserRecord = {
  id: OWNER_ID,
  email: "owner@example.com",
  fullName: "Owner",
  tenantId: TENANT_A,
  role: "owner",
  passwordHash: "fake-hash:correct-horse",
};

export const viewerUser: UserRecord = {
  id: VIEWER_ID,
  email: "viewer@example.com",
  fullName: "Viewer",
  tenantId: TENANT_A,
  role: "viewer",
  passwordHash: "fake-hash:correct-horse",
};
