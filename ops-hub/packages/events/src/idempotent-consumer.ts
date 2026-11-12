export interface DeliveredJob {
  tenantId: string;
  eventId: string;
}

export interface ProcessedEventStore {
  /** Atomically records (consumer, eventId) as processed; returns `true`
   * only the first time — a duplicate delivery of the same event returns
   * `false` without the caller re-running any business logic. */
  tryMarkProcessed(
    tenantId: string,
    consumer: string,
    eventId: string,
  ): Promise<boolean>;
}

/**
 * Wraps a queue handler so at-least-once delivery from the queue still
 * results in the handler running at most once per (consumer, eventId).
 */
export function withIdempotency<Job extends DeliveredJob>(
  consumer: string,
  store: ProcessedEventStore,
  handler: (job: Job) => Promise<void>,
): (job: Job) => Promise<void> {
  return async (job: Job) => {
    const isNewDelivery = await store.tryMarkProcessed(
      job.tenantId,
      consumer,
      job.eventId,
    );
    if (!isNewDelivery) {
      return;
    }
    await handler(job);
  };
}
