import { randomBytes } from "node:crypto";

import {
  InvalidCredentialsError,
  RateLimitedError,
  UnauthorizedError,
} from "./errors";
import type {
  AuthServiceDeps,
  AuthUser,
  UserRecord,
} from "./types";

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: AuthUser;
}

function toPublicUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    tenantId: user.tenantId,
    role: user.role,
  };
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async login(rawEmail: string, password: string): Promise<LoginResult> {
    const email = rawEmail.trim().toLowerCase();

    const retryAfter = await this.deps.limiter.blockedFor(email);
    if (retryAfter > 0) {
      throw new RateLimitedError(retryAfter);
    }

    const user = await this.deps.users.findByEmail(email);
    const valid = user
      ? await this.deps.passwords.verify(user.passwordHash, password)
      : false;

    if (!user || !valid) {
      await this.deps.limiter.recordFailure(email);
      throw new InvalidCredentialsError();
    }

    await this.deps.limiter.reset(email);

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      this.deps.clock.now().getTime() + this.deps.sessionTtlSeconds * 1000,
    );
    await this.deps.sessions.create(
      { token, userId: user.id, tenantId: user.tenantId, expiresAt },
      this.deps.sessionTtlSeconds,
    );

    return { token, expiresAt, user: toPublicUser(user) };
  }

  async logout(token: string): Promise<void> {
    await this.deps.sessions.delete(token);
  }

  async authenticate(token: string): Promise<AuthUser> {
    const session = await this.deps.sessions.get(token);
    if (!session) {
      throw new UnauthorizedError();
    }

    const user = await this.deps.users.findById(session.userId);
    if (!user) {
      throw new UnauthorizedError();
    }

    return toPublicUser(user);
  }
}
