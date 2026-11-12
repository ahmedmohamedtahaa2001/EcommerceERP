import { describe, expect, it } from "vitest";

import {
  OutboxDispatcher,
  type OutboxEventRecord,
  type OutboxStore,
  type QueueSender,
} from "../src/dispatcher";

function makeEvent(id: string): OutboxEventRecord {
  return {
    id,
    tenantId: "tenant-1",
    eventType: "demo.event",
    payload: { id },
    createdAt: new Date(),
    publishedAt: null,
    attempts: 0,
  };
}

class FakeStore implements OutboxStore {
  published: string[] = [];
  constructor(private pending: OutboxEventRecord[]) {}

  async listUnpublished(limit: number): Promise<OutboxEventRecord[]> {
    return this.pending
      .filter((e) => !this.published.includes(e.id))
      .slice(0, limit);
  }

  async markPublished(id: string): Promise<void> {
    this.published.push(id);
  }
}

describe("OutboxDispatcher", () => {
  it("sends every pending event to the queue and marks it published", async () => {
    const store = new FakeStore([makeEvent("e1"), makeEvent("e2")]);
    const sent: string[] = [];
    const queue: QueueSender = {
      async send(_queueName, data) {
        sent.push((data as { eventId: string }).eventId);
      },
    };

    const dispatcher = new OutboxDispatcher(store, queue, "events");
    const result = await dispatcher.publishPending();

    expect(result.sent).toBe(2);
    expect(sent).toEqual(["e1", "e2"]);
    expect(store.published).toEqual(["e1", "e2"]);
  });

  it("a crash mid-batch leaves the rest for the next run — no event is lost", async () => {
    const store = new FakeStore([
      makeEvent("e1"),
      makeEvent("e2"),
      makeEvent("e3"),
    ]);
    const sentDuringCrashRun: string[] = [];

    const crashingQueue: QueueSender = {
      async send(_queueName, data) {
        const eventId = (data as { eventId: string }).eventId;
        if (eventId === "e2") {
          throw new Error("worker killed mid-batch");
        }
        sentDuringCrashRun.push(eventId);
      },
    };

    const dispatcher = await (async () => {
      const d = new OutboxDispatcher(store, crashingQueue, "events");
      await expect(d.publishPending()).rejects.toThrow(
        "worker killed mid-batch",
      );
      return d;
    })();

    // e1 was sent and marked published before the crash; e2 and e3 were not.
    expect(sentDuringCrashRun).toEqual(["e1"]);
    expect(store.published).toEqual(["e1"]);

    // A fresh run (simulating the worker restarting) with a healthy queue
    // picks up exactly what's left — nothing lost, nothing skipped.
    const sentAfterRestart: string[] = [];
    const healthyQueue: QueueSender = {
      async send(_queueName, data) {
        sentAfterRestart.push((data as { eventId: string }).eventId);
      },
    };
    const restarted = new OutboxDispatcher(store, healthyQueue, "events");
    const result = await restarted.publishPending();

    expect(result.sent).toBe(2);
    expect(sentAfterRestart).toEqual(["e2", "e3"]);
    expect(store.published.sort()).toEqual(["e1", "e2", "e3"]);
    void dispatcher;
  });

  it("respects the batch size limit", async () => {
    const store = new FakeStore([
      makeEvent("e1"),
      makeEvent("e2"),
      makeEvent("e3"),
    ]);
    const sent: string[] = [];
    const queue: QueueSender = {
      async send(_queueName, data) {
        sent.push((data as { eventId: string }).eventId);
      },
    };

    const dispatcher = new OutboxDispatcher(store, queue, "events");
    const result = await dispatcher.publishPending(2);

    expect(result.sent).toBe(2);
    expect(sent).toEqual(["e1", "e2"]);
  });
});
