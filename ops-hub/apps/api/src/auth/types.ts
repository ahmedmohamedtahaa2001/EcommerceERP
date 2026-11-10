import type { Role } from "@ops-hub/domain";
import type { Clock } from "@ops-hub/shared";

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const LOGIN_ATTEMPT_LIMIT = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  tenantId: string | null;
  role: Role | null;
}

export interface UserRecord extends AuthUser {
  passwordHash: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  tenantId: string | null;
  expiresAt: Date;
}

export interface UserDirectory {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface SessionStore {
  create(session: SessionRecord, ttlSeconds: number): Promise<void>;
  get(token: string): Promise<SessionRecord | null>;
  delete(token: string): Promise<void>;
}

export interface RateLimiter {
  /** Seconds until the identifier may try again, or 0 when it is allowed. */
  blockedFor(key: string): Promise<number>;
  recordFailure(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(digest: string, password: string): Promise<boolean>;
}

export interface AuthServiceDeps {
  users: UserDirectory;
  passwords: PasswordHasher;
  sessions: SessionStore;
  limiter: RateLimiter;
  clock: Clock;
  sessionTtlSeconds: number;
}
