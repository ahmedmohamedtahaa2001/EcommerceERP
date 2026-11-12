import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export class CrmError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "CrmError";
    this.statusCode = statusCode;
  }
}

export type SegmentKey =
  | "vip"
  | "repeat"
  | "first_time"
  | "at_risk"
  | "dormant"
  | "open_issue"
  | "high_rto_risk";

export interface KpiValue {
  metric: string;
  value: number;
}

/**
 * Customer profiles, consent ledger, segments, automations, KPI service and
 * threshold alerts (roadmap Sprint 12).
 */
export class CrmService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
      /** Delivers an alert (email, WhatsApp). */
      deliver?: (alert: {
        kind: string;
        message: string;
        severity: string;
      }) => Promise<void>;
    },
  ) {}

  // ---- Profile -------------------------------------------------------------

  async profile(
    tenantId: string,
    customerId: string,
  ): Promise<{
    customerId: string;
    tags: string[];
    notes: string | null;
    mergedIntoId: string | null;
    orderCount: number;
    totalSpentMinor: number;
    lastOrderAt: Date | null;
    openTickets: number;
    openRefunds: number;
    codOutcomes: { collected: number; failed: number };
  }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const profile = await client.query<{
        tags: string[];
        notes: string | null;
        merged_into_id: string | null;
      }>(
        `select tags, notes, merged_into_id from customer_profiles
          where tenant_id=$1 and customer_id=$2`,
        [tenantId, customerId],
      );
      const row = profile.rows[0];
      const orders = await client.query<{
        count: string;
        spent: string;
        last: Date | null;
      }>(
        `select count(*)::text as count,
                coalesce(sum(p.amount_minor),0)::text as spent,
                max(o.created_at) as last
           from orders o join payments p on p.order_id=o.id and p.tenant_id=o.tenant_id
          where o.tenant_id=$1 and o.customer_id=$2`,
        [tenantId, customerId],
      );
      const o = orders.rows[0]!;
      const tickets = await client.query<{ count: string }>(
        `select count(*)::text as count from tickets
          where tenant_id=$1 and customer_id=$2 and status not in ('resolved','closed')`,
        [tenantId, customerId],
      );
      const refunds = await client.query<{ count: string }>(
        `select count(*)::text as count from refunds
          where tenant_id=$1 and order_id in (select id from orders where customer_id=$2)
            and status <> 'released'`,
        [tenantId, customerId],
      );
      const cod = await client.query<{ collected: string; failed: string }>(
        `select count(*) filter (where p.status='collected')::text as collected,
                count(*) filter (where p.status='failed')::text as failed
           from payments p join orders o2 on o2.id=p.order_id
          where p.tenant_id=$1 and o2.customer_id=$2 and p.method='cod'`,
        [tenantId, customerId],
      );
      return {
        customerId,
        tags: row?.tags ?? [],
        notes: row?.notes ?? null,
        mergedIntoId: row?.merged_into_id ?? null,
        orderCount: Number(o.count),
        totalSpentMinor: Number(o.spent),
        lastOrderAt: o.last,
        openTickets: Number(tickets.rows[0]?.count ?? 0),
        openRefunds: Number(refunds.rows[0]?.count ?? 0),
        codOutcomes: {
          collected: Number(cod.rows[0]?.collected ?? 0),
          failed: Number(cod.rows[0]?.failed ?? 0),
        },
      };
    });
  }

  /** Merging is explicit and audited by the caller; this only performs it. */
  async mergeProfiles(
    tenantId: string,
    input: { sourceCustomerId: string; targetCustomerId: string },
  ): Promise<{ merged: number }> {
    if (input.sourceCustomerId === input.targetCustomerId) {
      throw new CrmError("A profile cannot be merged into itself.");
    }
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const target = await client.query<{ id: string }>(
        `select id from customer_profiles where tenant_id=$1 and customer_id=$2`,
        [tenantId, input.targetCustomerId],
      );
      if (!target.rows[0]) {
        await client.query(
          `insert into customer_profiles (tenant_id, customer_id) values ($1,$2)`,
          [tenantId, input.targetCustomerId],
        );
      }
      await client.query(
        `update customer_profiles set merged_into_id=$3, updated_at=now()
          where tenant_id=$1 and customer_id=$2`,
        [tenantId, input.sourceCustomerId, input.targetCustomerId],
      );
      await client.query(
        `update orders set customer_id=$3 where tenant_id=$1 and customer_id=$2`,
        [tenantId, input.sourceCustomerId, input.targetCustomerId],
      );
      const r = await client.query(
        `update customer_profiles set merged_into_id=$3 where tenant_id=$1 and customer_id=$2`,
        [tenantId, input.sourceCustomerId, input.targetCustomerId],
      );
      return { merged: r.rowCount ?? 0 };
    });
  }

  // ---- Consent -------------------------------------------------------------

  async recordConsent(
    tenantId: string,
    input: {
      customerId: string;
      channel: string;
      purpose: "marketing" | "transactional";
      granted: boolean;
      source: string;
    },
  ): Promise<{ id: string; granted: boolean }> {
    const id = randomUUID();
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into consents
           (id, tenant_id, customer_id, channel, purpose, granted, source)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          tenantId,
          input.customerId,
          input.channel,
          input.purpose,
          input.granted,
          input.source,
        ],
      );
    });
    return { id, granted: input.granted };
  }

  /** Marketing messages are blocked without marketing consent. */
  async hasConsent(
    tenantId: string,
    input: { customerId: string; channel: string; purpose: string },
  ): Promise<boolean> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{ count: string }>(
        `select count(*)::text as count from consents
          where tenant_id=$1 and customer_id=$2 and channel=$3 and purpose=$4 and granted`,
        [tenantId, input.customerId, input.channel, input.purpose],
      );
      return Number(r.rows[0]?.count ?? 0) > 0;
    });
  }

  // ---- Segments ------------------------------------------------------------

  async createSegment(
    tenantId: string,
    input: {
      key: SegmentKey | string;
      name: string;
      definition?: Record<string, unknown>;
    },
  ): Promise<{ id: string; key: string }> {
    const id = randomUUID();
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into segments (id, tenant_id, key, name, definition)
         values ($1,$2,$3,$4,$5)`,
        [
          id,
          tenantId,
          input.key,
          input.name,
          JSON.stringify(input.definition ?? {}),
        ],
      );
    });
    return { id, key: input.key };
  }

  /** Recomputes a segment's membership from the operational data. */
  async refreshSegment(
    tenantId: string,
    segmentKey: string,
  ): Promise<{ segmentKey: string; members: number }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const segment = await client.query<{ id: string }>(
        `select id from segments where tenant_id=$1 and key=$2`,
        [tenantId, segmentKey],
      );
      const row = segment.rows[0];
      if (!row) throw new CrmError("Segment not found.", 404);

      const customers = await client.query<{
        customer_id: string;
        orders: string;
        last: Date | null;
        open_tickets: string;
      }>(
        `select c.id as customer_id,
                count(distinct o.id)::text as orders,
                max(o.created_at) as last,
                (select count(*) from tickets t
                  where t.tenant_id=c.tenant_id and t.customer_id=c.id
                    and t.status not in ('resolved','closed'))::text as open_tickets
           from customers c left join orders o on o.customer_id=c.id and o.tenant_id=c.tenant_id
          where c.tenant_id=$1 group by c.id`,
        [tenantId],
      );

      const matched: string[] = [];
      for (const customer of customers.rows) {
        const orders = Number(customer.orders);
        const daysSinceLastOrder = customer.last
          ? (this.deps.clock.now().getTime() -
              new Date(customer.last).getTime()) /
            (24 * 3600 * 1000)
          : Infinity;
        const openTickets = Number(customer.open_tickets);
        let keep = false;
        switch (segmentKey) {
          case "first_time":
            keep = orders === 1;
            break;
          case "repeat":
            keep = orders >= 2;
            break;
          case "vip":
            keep = orders >= 5;
            break;
          case "at_risk":
            keep = orders >= 1 && daysSinceLastOrder > 60;
            break;
          case "dormant":
            keep = orders >= 1 && daysSinceLastOrder > 120;
            break;
          case "open_issue":
            keep = openTickets > 0;
            break;
          case "high_rto_risk": {
            const rto = await client.query<{ count: string }>(
              `select count(*) filter (where o.status='returned')::text as count
                 from orders o where o.tenant_id=$1 and o.customer_id=$2`,
              [tenantId, customer.customer_id],
            );
            keep = Number(rto.rows[0]?.count ?? 0) > 0;
            break;
          }
          default:
            keep = false;
        }
        if (keep) matched.push(customer.customer_id);
      }

      await client.query(
        `delete from segment_members where tenant_id=$1 and segment_id=$2`,
        [tenantId, row.id],
      );
      for (const customerId of matched) {
        await client.query(
          `insert into segment_members (tenant_id, segment_id, customer_id)
           values ($1,$2,$3)`,
          [tenantId, row.id, customerId],
        );
      }
      return { segmentKey, members: matched.length };
    });
  }

  async listSegmentMembers(
    tenantId: string,
    segmentKey: string,
  ): Promise<{ customerId: string; addedAt: Date }[]> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{ customer_id: string; added_at: Date }>(
        `select sm.customer_id, sm.added_at from segment_members sm
           join segments s on s.id=sm.segment_id and s.tenant_id=sm.tenant_id
          where sm.tenant_id=$1 and s.key=$2`,
        [tenantId, segmentKey],
      );
      return r.rows.map((row) => ({
        customerId: row.customer_id,
        addedAt: row.added_at,
      }));
    });
  }

  // ---- Automations ---------------------------------------------------------

  async createAutomation(
    tenantId: string,
    input: {
      key: string;
      name: string;
      triggerEvent: string;
      conditions?: Record<string, unknown>;
      actions?: Record<string, unknown>[];
    },
  ): Promise<{ id: string; key: string }> {
    const id = randomUUID();
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into automations
           (id, tenant_id, key, name, trigger_event, conditions, actions)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          tenantId,
          input.key,
          input.name,
          input.triggerEvent,
          JSON.stringify(input.conditions ?? {}),
          JSON.stringify(input.actions ?? []),
        ],
      );
    });
    return { id, key: input.key };
  }

  /**
   * Runs the automations subscribed to an event, honouring the suppression
   * rules (open ticket, open refund, delivery exception, frequency cap,
   * quiet hours).
   */
  async runAutomations(
    tenantId: string,
    event: { type: string; payload: Record<string, unknown> },
    options: {
      now?: Date;
      quietHours?: { from: number; to: number };
      frequencyCapPerWeek?: number;
    } = {},
  ): Promise<{ ran: number; suppressed: number; reasons: string[] }> {
    const now = options.now ?? this.deps.clock.now();
    const reasons: string[] = [];
    let ran = 0;
    let suppressed = 0;

    const automations = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<{
          id: string;
          key: string;
          conditions: Record<string, unknown>;
          actions: Record<string, unknown>[];
        }>(
          `select id, key, conditions, actions from automations
          where tenant_id=$1 and trigger_event=$2 and enabled`,
          [tenantId, event.type],
        );
        return r.rows;
      },
    );

    for (const automation of automations) {
      const conditions = automation.conditions ?? {};
      const openTicket = Boolean(conditions.requireNoOpenTicket);
      const openRefund = Boolean(conditions.requireNoOpenRefund);
      const noDeliveryException = Boolean(
        conditions.requireNoDeliveryException,
      );

      if (openTicket || openRefund || noDeliveryException) {
        const blocked = await this.suppressionReason(
          tenantId,
          event,
          conditions,
        );
        if (blocked) {
          suppressed++;
          reasons.push(`${automation.key}: ${blocked}`);
          continue;
        }
      }

      if (
        options.quietHours &&
        now.getHours() >= options.quietHours.from &&
        now.getHours() < options.quietHours.to
      ) {
        suppressed++;
        reasons.push(`${automation.key}: quiet hours`);
        continue;
      }

      if (options.frequencyCapPerWeek) {
        const since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        const runs = await withTenant(
          this.deps.pool,
          tenantId,
          async (client) => {
            const r = await client.query<{ count: string }>(
              `select count(*)::text as count from automation_runs
              where tenant_id=$1 and automation_id=$2 and ran_at >= $3`,
              [tenantId, automation.id, since],
            );
            return Number(r.rows[0]?.count ?? 0);
          },
        );
        if (runs >= options.frequencyCapPerWeek) {
          suppressed++;
          reasons.push(`${automation.key}: frequency cap reached`);
          continue;
        }
      }

      await withTenant(this.deps.pool, tenantId, async (client) => {
        await client.query(
          `insert into automation_runs (tenant_id, automation_id, status, result)
           values ($1,$2,'ok',$3)`,
          [tenantId, automation.id, JSON.stringify({ event: event.type })],
        );
      });
      ran++;
    }
    return { ran, suppressed, reasons };
  }

  private async suppressionReason(
    tenantId: string,
    event: { payload: Record<string, unknown> },
    conditions: Record<string, unknown>,
  ): Promise<string | null> {
    const customerId = event.payload.customerId;
    const orderId = event.payload.orderId;
    return withTenant(this.deps.pool, tenantId, async (client) => {
      if (conditions.requireNoOpenTicket) {
        const r = await client.query<{ count: string }>(
          `select count(*)::text as count from tickets
            where tenant_id=$1 and status not in ('resolved','closed')
              and (customer_id=$2 or order_id=$3)`,
          [tenantId, customerId ?? null, orderId ?? null],
        );
        if (Number(r.rows[0]?.count ?? 0) > 0) return "open ticket";
      }
      if (conditions.requireNoOpenRefund) {
        const r = await client.query<{ count: string }>(
          `select count(*)::text as count from refunds
            where tenant_id=$1 and status <> 'released' and order_id=$2`,
          [tenantId, orderId ?? null],
        );
        if (Number(r.rows[0]?.count ?? 0) > 0) return "open refund";
      }
      if (conditions.requireNoDeliveryException) {
        const r = await client.query<{ count: string }>(
          `select count(*)::text as count from shipments
            where tenant_id=$1 and status in ('delivery_exception','returned_to_sender')
              and order_id=$2`,
          [tenantId, orderId ?? null],
        );
        if (Number(r.rows[0]?.count ?? 0) > 0) return "delivery exception";
      }
      return null;
    });
  }

  // ---- KPI & alerts --------------------------------------------------------

  /** Computes the documented KPI set for a day. */
  async kpis(tenantId: string, date: Date): Promise<KpiValue[]> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const dayStart = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

      const orders = await client.query<{ count: string }>(
        `select count(*)::text as count from orders
          where tenant_id=$1 and created_at >= $2 and created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      const delivered = await client.query<{ count: string }>(
        `select count(*)::text as count from shipments
          where tenant_id=$1 and status='delivered'
            and created_at >= $2 and created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      const oversold = await client.query<{ count: string }>(
        `select count(*)::text as count from stock_balances sb
          where sb.tenant_id=$1 and sb.bucket='on_hand' and sb.quantity < 0`,
        [tenantId],
      );
      const exceptions = await client.query<{ count: string }>(
        `select count(*)::text as count from exceptions
          where tenant_id=$1 and status='open'`,
        [tenantId],
      );
      const cod = await client.query<{ expected: string; collected: string }>(
        `select coalesce(sum(p.amount_minor),0)::text as expected,
                coalesce(sum(p.amount_minor) filter (where p.status='collected'),0)::text as collected
           from payments p join orders o on o.id=p.order_id
          where p.tenant_id=$1 and p.method='cod'
            and o.created_at >= $2 and o.created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      const codExpected = Number(cod.rows[0]?.expected ?? 0);
      const codCollected = Number(cod.rows[0]?.collected ?? 0);

      return [
        { metric: "orders_created", value: Number(orders.rows[0]?.count ?? 0) },
        {
          metric: "shipments_delivered",
          value: Number(delivered.rows[0]?.count ?? 0),
        },
        {
          metric: "oversold_skus",
          value: Number(oversold.rows[0]?.count ?? 0),
        },
        {
          metric: "open_exceptions",
          value: Number(exceptions.rows[0]?.count ?? 0),
        },
        {
          metric: "cod_collection_rate",
          value:
            codExpected === 0
              ? 100
              : Math.round((codCollected / codExpected) * 100),
        },
        { metric: "cod_expected_minor", value: codExpected },
        { metric: "cod_collected_minor", value: codCollected },
      ];
    });
  }

  /** Fires a threshold alert once per breach window. */
  async evaluateAlerts(
    tenantId: string,
    thresholds: {
      oversold?: number;
      openExceptions?: number;
      unmatchedCodMinor?: number;
      codCollectionRate?: number;
    },
  ): Promise<{ fired: { kind: string; message: string }[] }> {
    const kpis = await this.kpis(tenantId, this.deps.clock.now());
    const byMetric = new Map(kpis.map((k) => [k.metric, k.value]));
    const fired: { kind: string; message: string }[] = [];

    const checks: {
      kind: string;
      value: number;
      limit: number;
      message: string;
    }[] = [];
    if (thresholds.oversold !== undefined) {
      checks.push({
        kind: "OVERSOLD",
        value: byMetric.get("oversold_skus") ?? 0,
        limit: thresholds.oversold,
        message: `${byMetric.get("oversold_skus") ?? 0} SKU(s) are oversold`,
      });
    }
    if (thresholds.openExceptions !== undefined) {
      checks.push({
        kind: "OPEN_EXCEPTIONS",
        value: byMetric.get("open_exceptions") ?? 0,
        limit: thresholds.openExceptions,
        message: `${byMetric.get("open_exceptions") ?? 0} exception(s) are still open`,
      });
    }
    if (thresholds.unmatchedCodMinor !== undefined) {
      const unmatched =
        (byMetric.get("cod_expected_minor") ?? 0) -
        (byMetric.get("cod_collected_minor") ?? 0);
      checks.push({
        kind: "COD_UNMATCHED",
        value: unmatched,
        limit: thresholds.unmatchedCodMinor,
        message: `Uncollected COD is ${unmatched} minor units`,
      });
    }
    if (thresholds.codCollectionRate !== undefined) {
      const rate = byMetric.get("cod_collection_rate") ?? 100;
      checks.push({
        kind: "COD_COLLECTION_RATE",
        value: 100 - rate,
        limit: 100 - thresholds.codCollectionRate,
        message: `COD collection rate is ${rate}%`,
      });
    }

    for (const check of checks) {
      if (check.value <= check.limit) continue;
      const existing = await withTenant(
        this.deps.pool,
        tenantId,
        async (client) => {
          const r = await client.query<{ count: string }>(
            `select count(*)::text as count from alerts
            where tenant_id=$1 and kind=$2 and triggered_at > now() - interval '24 hours'`,
            [tenantId, check.kind],
          );
          return Number(r.rows[0]?.count ?? 0);
        },
      );
      if (existing > 0) continue;

      await withTenant(this.deps.pool, tenantId, async (client) => {
        await client.query(
          `insert into alerts (tenant_id, kind, severity, message)
           values ($1,$2,'warning',$3)`,
          [tenantId, check.kind, check.message],
        );
      });
      if (this.deps.deliver) {
        await this.deps.deliver({
          kind: check.kind,
          message: check.message,
          severity: "warning",
        });
      }
      fired.push({ kind: check.kind, message: check.message });
    }
    return { fired };
  }
}
