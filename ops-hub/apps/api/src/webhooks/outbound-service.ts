import crypto from "node:crypto";
import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

export interface WebhookSubscription {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  tenantId: string;
  subscriptionId: string;
  eventType: string;
  eventId: string;
  payload: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
  nextAttemptAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
}

export const MAX_DELIVERY_ATTEMPTS = 5;

/** Exponential backoff: 1m, 5m, 15m, 45m, 3h. */
export function backoffSeconds(attempt: number): number {
  const schedule = [60, 300, 900, 2700, 10800];
  return schedule[Math.min(attempt - 1, schedule.length - 1)] ?? 10800;
}

/** The signature a receiver verifies: HMAC-SHA256 of the raw body. */
export function signPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function toSubscription(row: Record<string, unknown>): WebhookSubscription {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    url: String(row.url),
    events: String(row.events)
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0),
    secret: String(row.secret),
    enabled: Boolean(row.enabled),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export class OutboundWebhookService {
  constructor(private readonly pool: Pool) {}

  async createSubscription(
    tenantId: string,
    input: { name: string; url: string; events: string[]; secret?: string },
  ): Promise<WebhookSubscription> {
    const secret = input.secret ?? crypto.randomBytes(24).toString("hex");
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query(
        `insert into webhook_subscriptions (tenant_id, name, url, events, secret)
         values ($1,$2,$3,$4,$5) returning *`,
        [tenantId, input.name, input.url, input.events.join(","), secret],
      );
      return toSubscription(r.rows[0]);
    });
  }

  async listSubscriptions(tenantId: string): Promise<WebhookSubscription[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query(
        `select * from webhook_subscriptions where tenant_id=$1 order by created_at asc`,
        [tenantId],
      );
      return r.rows.map(toSubscription);
    });
  }

  async deleteSubscription(tenantId: string, id: string): Promise<boolean> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query(
        `delete from webhook_subscriptions where tenant_id=$1 and id=$2`,
        [tenantId, id],
      );
      return (r.rowCount ?? 0) > 0;
    });
  }

  /** Queue one delivery per subscription that listens to `eventType`. */
  async enqueue(
    tenantId: string,
    eventType: string,
    eventId: string,
    payload: unknown,
  ): Promise<number> {
    const subs = (await this.listSubscriptions(tenantId)).filter(
      (s) => s.enabled && s.events.includes(eventType),
    );
    if (subs.length === 0) return 0;
    const body = JSON.stringify(payload);
    await withTenant(this.pool, tenantId, async (client) => {
      for (const sub of subs) {
        await client.query(
          `insert into webhook_deliveries
             (tenant_id, subscription_id, event_type, event_id, payload, status, next_attempt_at)
           values ($1,$2,$3,$4,$5,'pending', now())`,
          [tenantId, sub.id, eventType, eventId, body],
        );
      }
    });
    return subs.length;
  }

  async listDeliveries(
    tenantId: string,
    filter: { subscriptionId?: string; status?: string } = {},
  ): Promise<WebhookDelivery[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.subscriptionId) {
        params.push(filter.subscriptionId);
        conditions.push(`subscription_id = $${params.length}`);
      }
      if (filter.status) {
        params.push(filter.status);
        conditions.push(`status = $${params.length}`);
      }
      const r = await client.query(
        `select * from webhook_deliveries where ${conditions.join(" and ")}
          order by created_at asc`,
        params,
      );
      return r.rows.map((row) => this.toDelivery(row));
    });
  }

  /** Attempt one delivery. Returns the updated row. */
  async deliver(
    tenantId: string,
    deliveryId: string,
  ): Promise<WebhookDelivery> {
    const delivery = await this.getDelivery(tenantId, deliveryId);
    if (!delivery) throw new Error("delivery not found");
    const subs = await this.listSubscriptions(tenantId);
    const sub = subs.find((s) => s.id === delivery.subscriptionId);
    if (!sub) throw new Error("subscription not found");

    const body = delivery.payload;
    const signature = signPayload(sub.secret, body);
    let status: number | null = null;
    let responseBody: string | null = null;
    let error: string | null = null;

    try {
      const res = await fetch(sub.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ops-hub-signature": signature,
          "x-ops-hub-event": delivery.eventType,
          "x-ops-hub-delivery": delivery.id,
        },
        body,
      });
      status = res.status;
      responseBody = await res.text();
      if (!res.ok) {
        error = `HTTP ${res.status}`;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const attempts = delivery.attempts + 1;
    const ok = status !== null && status >= 200 && status < 300;
    const exhausted = attempts >= MAX_DELIVERY_ATTEMPTS;

    return this.updateDelivery(tenantId, delivery.id, {
      attempts,
      status: ok ? "delivered" : exhausted ? "failed" : "pending",
      responseStatus: status,
      responseBody,
      error,
      nextAttemptAt:
        ok || exhausted
          ? null
          : new Date(Date.now() + backoffSeconds(attempts) * 1000),
      deliveredAt: ok ? new Date() : null,
    });
  }

  /** Manual replay: resets a failed delivery and tries again immediately. */
  async replay(tenantId: string, deliveryId: string): Promise<WebhookDelivery> {
    const current = await this.getDelivery(tenantId, deliveryId);
    if (!current) throw new Error("delivery not found");
    await this.updateDelivery(tenantId, deliveryId, {
      attempts: current.attempts,
      status: "pending",
      responseStatus: current.responseStatus,
      responseBody: current.responseBody,
      error: null,
      nextAttemptAt: new Date(),
      deliveredAt: null,
    });
    return this.deliver(tenantId, deliveryId);
  }

  private async getDelivery(
    tenantId: string,
    id: string,
  ): Promise<WebhookDelivery | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query(
        `select * from webhook_deliveries where tenant_id=$1 and id=$2`,
        [tenantId, id],
      );
      return r.rows[0] ? this.toDelivery(r.rows[0]) : null;
    });
  }

  private async updateDelivery(
    tenantId: string,
    id: string,
    patch: {
      attempts: number;
      status: string;
      responseStatus: number | null;
      responseBody: string | null;
      error: string | null;
      nextAttemptAt: Date | null;
      deliveredAt: Date | null;
    },
  ): Promise<WebhookDelivery> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query(
        `update webhook_deliveries
            set attempts=$3, status=$4, response_status=$5, response_body=$6,
                error=$7, next_attempt_at=$8, delivered_at=$9
          where tenant_id=$1 and id=$2
          returning *`,
        [
          tenantId,
          id,
          patch.attempts,
          patch.status,
          patch.responseStatus,
          patch.responseBody,
          patch.error,
          patch.nextAttemptAt,
          patch.deliveredAt,
        ],
      );
      return this.toDelivery(r.rows[0]);
    });
  }

  private toDelivery(row: Record<string, unknown>): WebhookDelivery {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      subscriptionId: String(row.subscription_id),
      eventType: String(row.event_type),
      eventId: String(row.event_id),
      payload: String(row.payload),
      status: row.status as WebhookDelivery["status"],
      attempts: Number(row.attempts),
      responseStatus:
        row.response_status === null ? null : Number(row.response_status),
      responseBody: (row.response_body as string | null) ?? null,
      error: (row.error as string | null) ?? null,
      nextAttemptAt: row.next_attempt_at
        ? new Date(row.next_attempt_at as string)
        : null,
      deliveredAt: row.delivered_at
        ? new Date(row.delivered_at as string)
        : null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
