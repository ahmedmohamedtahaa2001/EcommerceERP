import type { OutboxEventRecord } from "./index";

export type { OutboxEventRecord };

export interface OutboxStore {
  listUnpublished(limit: number): Promise<OutboxEventRecord[]>;
  markPublished(id: string): Promise<void>;
}

export interface QueueSender {
  send(queueName: string, data: unknown): Promise<unknown>;
}

const DEFAULT_BATCH_SIZE = 50;

/**
 * Reads unpublished outbox rows and sends each to the queue, marking it
 * published only after the send succeeds. If the process dies partway
 * through a batch, the already-published rows stay published and the rest
 * are picked up by the next `publishPending()` call — at-least-once
 * delivery, never a lost event.
 */
export class OutboxDispatcher {
  constructor(
    private readonly store: OutboxStore,
    private readonly queue: QueueSender,
    private readonly queueName: string,
  ) {}

  async publishPending(
    batchSize = DEFAULT_BATCH_SIZE,
  ): Promise<{ sent: number }> {
    const events = await this.store.listUnpublished(batchSize);
    let sent = 0;
    for (const event of events) {
      await this.queue.send(this.queueName, {
        eventId: event.id,
        eventType: event.eventType,
        tenantId: event.tenantId,
        payload: event.payload,
      });
      await this.store.markPublished(event.id);
      sent += 1;
    }
    return { sent };
  }
}
