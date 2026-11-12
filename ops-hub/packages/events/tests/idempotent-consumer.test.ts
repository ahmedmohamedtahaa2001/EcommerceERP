import { describe, expect, it } from "vitest";

import {
  withIdempotency,
  type ProcessedEventStore,
} from "../src/idempotent-consumer";

class FakeProcessedStore implements ProcessedEventStore {
  private readonly seen = new Set<string>();

  async tryMarkProcessed(
    _tenantId: string,
    consumer: string,
    eventId: string,
  ): Promise<boolean> {
    const key = `${consumer}:${eventId}`;
    if (this.seen.has(key)) {
      return false;
    }
    this.seen.add(key);
    return true;
  }
}

describe("withIdempotency", () => {
  it("runs the handler on the first delivery of an event", async () => {
    const store = new FakeProcessedStore();
    let calls = 0;
    const wrapped = withIdempotency("test-consumer", store, async () => {
      calls += 1;
    });

    await wrapped({ tenantId: "tenant-1", eventId: "event-1" });

    expect(calls).toBe(1);
  });

  it("skips the handler on a duplicate delivery of the same event", async () => {
    const store = new FakeProcessedStore();
    let calls = 0;
    const wrapped = withIdempotency("test-consumer", store, async () => {
      calls += 1;
    });

    const job = { tenantId: "tenant-1", eventId: "event-1" };
    await wrapped(job);
    await wrapped(job); // simulated re-delivery (at-least-once from the queue)
    await wrapped(job);

    expect(calls).toBe(1);
  });

  it("treats the same event id as distinct per consumer", async () => {
    const store = new FakeProcessedStore();
    let callsA = 0;
    let callsB = 0;
    const consumerA = withIdempotency("consumer-a", store, async () => {
      callsA += 1;
    });
    const consumerB = withIdempotency("consumer-b", store, async () => {
      callsB += 1;
    });

    const job = { tenantId: "tenant-1", eventId: "event-1" };
    await consumerA(job);
    await consumerB(job);

    expect(callsA).toBe(1);
    expect(callsB).toBe(1);
  });
});
