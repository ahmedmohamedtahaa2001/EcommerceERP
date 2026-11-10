import type Redis from "ioredis";

import type { RateLimiter } from "./types";

export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly limit: number,
    private readonly windowSeconds: number,
    private readonly prefix = "auth:login:",
  ) {}

  private key(identifier: string): string {
    return this.prefix + identifier.toLowerCase();
  }

  async blockedFor(identifier: string): Promise<number> {
    const key = this.key(identifier);
    const count = Number((await this.redis.get(key)) ?? "0");
    if (count < this.limit) {
      return 0;
    }

    const ttl = await this.redis.ttl(key);
    return ttl > 0 ? ttl : this.windowSeconds;
  }

  async recordFailure(identifier: string): Promise<void> {
    const key = this.key(identifier);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, this.windowSeconds);
    }
  }

  async reset(identifier: string): Promise<void> {
    await this.redis.del(this.key(identifier));
  }
}
