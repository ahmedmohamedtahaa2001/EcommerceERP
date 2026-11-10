import type Redis from "ioredis";

import type { SessionRecord, SessionStore } from "./types";

interface StoredSession {
  userId: string;
  tenantId: string | null;
  expiresAt: string;
}

export class RedisSessionStore implements SessionStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = "auth:session:",
  ) {}

  async create(session: SessionRecord, ttlSeconds: number): Promise<void> {
    const stored: StoredSession = {
      userId: session.userId,
      tenantId: session.tenantId,
      expiresAt: session.expiresAt.toISOString(),
    };
    await this.redis.set(
      this.prefix + session.token,
      JSON.stringify(stored),
      "EX",
      ttlSeconds,
    );
  }

  async get(token: string): Promise<SessionRecord | null> {
    const raw = await this.redis.get(this.prefix + token);
    if (!raw) {
      return null;
    }

    let stored: StoredSession;
    try {
      stored = JSON.parse(raw) as StoredSession;
    } catch {
      // An unreadable session is treated as absent, never as authenticated.
      return null;
    }

    return {
      token,
      userId: stored.userId,
      tenantId: stored.tenantId,
      expiresAt: new Date(stored.expiresAt),
    };
  }

  async delete(token: string): Promise<void> {
    await this.redis.del(this.prefix + token);
  }
}
