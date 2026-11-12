import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export interface StarterAutomation {
  key: string;
  name: string;
  triggerEvent: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>[];
  /** Delay before the automation runs, in hours. */
  delayHours: number;
}

/**
 * The starter automations (roadmap P3-S12-T05): abandoned cart, post-delivery
 * follow-up, reorder reminder and win-back. Each one can be switched off
 * per tenant.
 */
export const STARTER_AUTOMATIONS: StarterAutomation[] = [
  {
    key: "abandoned_cart",
    name: "Abandoned cart reminder",
    triggerEvent: "cart.abandoned",
    conditions: { requireNoOpenTicket: true },
    actions: [
      {
        type: "send_message",
        template: "abandoned_cart",
        channel: "email",
      },
    ],
    delayHours: 6,
  },
  {
    key: "post_delivery_followup",
    name: "Post-delivery follow-up",
    triggerEvent: "order.delivered",
    conditions: { requireNoOpenTicket: true, requireNoOpenRefund: true },
    actions: [
      {
        type: "send_message",
        template: "delivered",
        channel: "email",
      },
    ],
    delayHours: 48,
  },
  {
    key: "reorder_reminder",
    name: "Reorder reminder",
    triggerEvent: "customer.consent_given",
    conditions: { requireNoOpenTicket: true },
    actions: [
      {
        type: "send_message",
        template: "reorder_reminder",
        channel: "email",
      },
    ],
    delayHours: 0,
  },
  {
    key: "win_back",
    name: "Win back an inactive customer",
    triggerEvent: "customer.dormant",
    conditions: { requireNoOpenTicket: true, requireNoOpenRefund: true },
    actions: [
      {
        type: "send_message",
        template: "win_back",
        channel: "email",
      },
    ],
    delayHours: 0,
  },
];

export class StarterAutomationError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "StarterAutomationError";
    this.statusCode = statusCode;
  }
}

/**
 * Installs the starter automations for a tenant and lets each one be
 * switched off independently.
 */
export class StarterAutomationService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
    },
  ) {}

  /** Creates any missing starter automation. Returns how many were added. */
  async install(tenantId: string): Promise<{ created: number }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      let created = 0;
      for (const automation of STARTER_AUTOMATIONS) {
        const r = await client.query(
          `insert into automations
             (tenant_id, key, name, trigger_event, conditions, actions)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (tenant_id, key) do nothing`,
          [
            tenantId,
            automation.key,
            automation.name,
            automation.triggerEvent,
            JSON.stringify(automation.conditions),
            JSON.stringify(automation.actions),
          ],
        );
        created += r.rowCount ?? 0;
      }
      return { created };
    });
  }

  async list(tenantId: string): Promise<
    {
      key: string;
      name: string;
      triggerEvent: string;
      enabled: boolean;
    }[]
  > {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{
        key: string;
        name: string;
        trigger_event: string;
        enabled: boolean;
      }>(
        `select key, name, trigger_event, enabled from automations
          where tenant_id=$1 order by key asc`,
        [tenantId],
      );
      return r.rows.map((row) => ({
        key: row.key,
        name: row.name,
        triggerEvent: row.trigger_event,
        enabled: row.enabled,
      }));
    });
  }

  /** The per-tenant switch for one starter automation. */
  async setEnabled(
    tenantId: string,
    key: string,
    enabled: boolean,
  ): Promise<{ key: string; enabled: boolean }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query(
        `update automations set enabled=$3 where tenant_id=$1 and key=$2
         returning key, enabled`,
        [tenantId, key, enabled],
      );
      if (!r.rows[0]) {
        throw new StarterAutomationError(
          `Automation "${key}" is not installed.`,
          404,
        );
      }
      return { key: r.rows[0].key, enabled: r.rows[0].enabled };
    });
  }

  /** Runs a starter automation against a fixture-like payload and returns
   * what it would send. Nothing is delivered: the automation records a run
   * so a human can see it fired. */
  async runFixture(
    tenantId: string,
    key: string,
    payload: Record<string, unknown>,
  ): Promise<{
    key: string;
    ran: boolean;
    actions: Record<string, unknown>[];
  }> {
    const automation = STARTER_AUTOMATIONS.find((a) => a.key === key);
    if (!automation) {
      throw new StarterAutomationError(
        `Unknown starter automation "${key}".`,
        404,
      );
    }
    const installed = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<{ id: string; enabled: boolean }>(
          `select id, enabled from automations where tenant_id=$1 and key=$2`,
          [tenantId, key],
        );
        return r.rows[0];
      },
    );
    if (!installed) {
      throw new StarterAutomationError(
        `Automation "${key}" is not installed.`,
        404,
      );
    }
    if (!installed.enabled) {
      return { key, ran: false, actions: [] };
    }
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into automation_runs (tenant_id, automation_id, status, result)
         values ($1,$2,'ok',$3)`,
        [tenantId, installed.id, JSON.stringify(payload)],
      );
    });
    return { key, ran: true, actions: automation.actions };
  }
}

/** A fixture payload per starter automation, used by the tests. */
export const STARTER_AUTOMATION_FIXTURES: Record<
  string,
  Record<string, unknown>
> = {
  abandoned_cart: {
    customerId: "c-1",
    orderId: "o-1",
    abandonedAt: "2026-02-01",
  },
  post_delivery_followup: { customerId: "c-1", orderId: "o-1" },
  reorder_reminder: { customerId: "c-1", sku: "SKU-1" },
  win_back: { customerId: "c-1", lastOrderAt: "2025-11-01" },
};

export const randomId = (): string => randomUUID();
