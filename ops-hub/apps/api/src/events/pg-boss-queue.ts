import type PgBoss from "pg-boss";

import type { QueueSender } from "@ops-hub/events/dispatcher";

export class PgBossQueueSender implements QueueSender {
  constructor(private readonly boss: PgBoss) {}

  async send(queueName: string, data: unknown): Promise<unknown> {
    return this.boss.send(queueName, data as object);
  }
}
