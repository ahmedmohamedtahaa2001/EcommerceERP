import { createDb } from "@ops-hub/db";
import { OutboxDispatcher } from "@ops-hub/events/dispatcher";
import {
  withIdempotency,
  type DeliveredJob,
} from "@ops-hub/events/idempotent-consumer";
import PgBoss from "pg-boss";

import { PgBossQueueSender } from "./pg-boss-queue";
import { PgOutboxStore } from "./pg-outbox-store";
import { PgProcessedEventStore } from "./pg-processed-event-store";

export const DOMAIN_EVENTS_QUEUE = "domain-events";
const POLL_INTERVAL_MS = 2_000;

export type DomainEventJob = DeliveredJob & {
  eventType: string;
  payload: unknown;
};

/**
 * Starts the pg-boss worker: a dispatcher that polls `outbox_events` and
 * sends each unpublished row to the `domain-events` queue, plus one
 * idempotent consumer per registered handler. Call `stop()` to shut both
 * down cleanly (used by tests and by process signal handlers).
 */
export async function startEventWorker(
  databaseUrl: string,
  consumers: Record<string, (job: DomainEventJob) => Promise<void>>,
): Promise<{ stop: () => Promise<void> }> {
  const { pool } = createDb(databaseUrl);
  const boss = new PgBoss(databaseUrl);
  await boss.start();
  await boss.createQueue(DOMAIN_EVENTS_QUEUE);

  const dispatcher = new OutboxDispatcher(
    new PgOutboxStore(pool),
    new PgBossQueueSender(boss),
    DOMAIN_EVENTS_QUEUE,
  );
  const processedStore = new PgProcessedEventStore(pool);

  for (const [consumerName, handler] of Object.entries(consumers)) {
    const idempotentHandler = withIdempotency(
      consumerName,
      processedStore,
      handler,
    );
    await boss.work<DomainEventJob>(DOMAIN_EVENTS_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await idempotentHandler(job.data);
      }
    });
  }

  const interval = setInterval(() => {
    dispatcher.publishPending().catch((error: unknown) => {
      // A crash here leaves unpublished rows for the next tick — see
      // OutboxDispatcher's own docs. Logging is enough; nothing to retry
      // synchronously.
      console.error("outbox dispatch failed", error);
    });
  }, POLL_INTERVAL_MS);

  return {
    async stop() {
      clearInterval(interval);
      await boss.stop();
      await pool.end();
    },
  };
}
