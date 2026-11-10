import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RedisRateLimiter } from "../src/auth/redis-rate-limiter";
import { RedisSessionStore } from "../src/auth/redis-session-store";

const runDbTests = process.env.RUN_DB_TESTS === "1";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const identifier = `it-${Date.now()}@example.com`;

let redis: Redis;

describe.skipIf(!runDbTests)("Redis auth stores", () => {
  beforeAll(() => {
    redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  });

  afterAll(async () => {
    await redis.del(`auth:login:${identifier}`);
    redis.disconnect();
  });

  it("expires sessions after their TTL", async () => {
    const store = new RedisSessionStore(redis);
    const token = `it-session-${Date.now()}`;

    await store.create(
      {
        token,
        userId: "user-1",
        tenantId: null,
        expiresAt: new Date(Date.now() + 1000),
      },
      1,
    );
    await expect(store.get(token)).resolves.toMatchObject({ token });

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await expect(store.get(token)).resolves.toBeNull();
  });

  it("blocks after the configured attempt limit and resets", async () => {
    const limiter = new RedisRateLimiter(redis, 5, 900);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await limiter.recordFailure(identifier);
    }
    await expect(limiter.blockedFor(identifier)).resolves.toBeGreaterThan(0);

    await limiter.reset(identifier);
    await expect(limiter.blockedFor(identifier)).resolves.toBe(0);
  });
});
