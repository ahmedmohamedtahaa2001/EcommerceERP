import { randomUUID } from "node:crypto";

import type Redis from "ioredis";

/** Raised when a lock can't be acquired within the retry budget. */
export class LockTimeoutError extends Error {
  constructor(key: string) {
    super(`Could not acquire lock for ${key} in time.`);
  }
}

/**
 * A short-lived mutual-exclusion lock over Redis (`SET key value NX PX ttl`).
 * Used to serialize concurrent allocation attempts against the same
 * variant+location so two requests can never both see the same "last unit"
 * as available.
 */
export class RedisLock {
  constructor(
    private readonly redis: Redis,
    private readonly ttlMs = 5_000,
    private readonly retryDelayMs = 20,
    private readonly maxWaitMs = 3_000,
  ) {}

  /** Runs `work` while holding the lock for `key`; releases it afterward. */
  async withLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const deadline = Date.now() + this.maxWaitMs;

    while (true) {
      const acquired = await this.redis.set(key, token, "PX", this.ttlMs, "NX");
      if (acquired === "OK") {
        break;
      }
      if (Date.now() >= deadline) {
        throw new LockTimeoutError(key);
      }
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
    }

    try {
      return await work();
    } finally {
      // Only release if we still hold it (it may have expired under heavy
      // contention); a Lua script keeps the check-and-delete atomic.
      await this.redis.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then
           return redis.call("del", KEYS[1])
         else
           return 0
         end`,
        1,
        key,
        token,
      );
    }
  }
}
