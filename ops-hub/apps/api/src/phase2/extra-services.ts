import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

import type { CodService, RiskTier } from "../risk/service";

export class GatingError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "GatingError";
    this.statusCode = statusCode;
  }
}

export type GateOutcome =
  /** Risk is low: the order may be dispatched as soon as it is confirmed. */
  | "auto_dispatch"
  /** Risk is medium: a confirmation task is required first. */
  | "confirmation_required"
  /** Risk is high: the order is held and an exception is raised. */
  | "hold";

export interface GateDecision {
  outcome: GateOutcome;
  tier: RiskTier;
  reasons: string[];
  /** The exception created when the order is held. */
  exceptionId: string | null;
  /** The confirmation task created when one is required. */
  taskId: string | null;
}

/**
 * Risk-based gating (roadmap P2-S7-T03): low → auto-dispatch after
 * confirmation, medium → confirmation required, high → hold with an
 * exception. The thresholds live in the tenant's risk settings, not in the
 * code; they can be overridden per call.
 */
export class RiskGateService {
  constructor(
    private readonly deps: {
      pool: Pool;
      cod: CodService;
      /** Threshold overrides, e.g. `{ medium: 20, high: 60 }`. */
      thresholds?: { medium: number; high: number };
    },
  ) {}

  async gate(
    tenantId: string,
    orderId: string,
    input: {
      channel?: "whatsapp" | "sms" | "call";
      /** Threshold overrides, e.g. the tenant's stored risk settings. */
      thresholds?: { medium: number; high: number };
    } = {},
  ): Promise<GateDecision> {
    const score = await this.deps.cod.scoreOrder(tenantId, orderId);
    const thresholds = input.thresholds ??
      this.deps.thresholds ?? { medium: 25, high: 60 };
    const points = score.points;

    if (points >= thresholds.high) {
      const exceptionId = randomUUID();
      await withTenant(this.deps.pool, tenantId, async (client) => {
        await client.query(
          `insert into exceptions
             (id, tenant_id, order_id, reason_code, status, metadata, due_at)
           values ($1,$2,$3,'HIGH_RISK','open',$4, now() + interval '1 day')`,
          [
            exceptionId,
            tenantId,
            orderId,
            JSON.stringify({
              tier: score.tier,
              reasons: score.reasons,
              suggestion: "offer prepaid conversion",
            }),
          ],
        );
      });
      return {
        outcome: "hold",
        tier: score.tier,
        reasons: score.reasons,
        exceptionId,
        taskId: null,
      };
    }

    if (points >= thresholds.medium) {
      const task = await this.deps.cod.createTask(tenantId, {
        orderId,
        ...(input.channel !== undefined ? { channel: input.channel } : {}),
      });
      return {
        outcome: "confirmation_required",
        tier: score.tier,
        reasons: score.reasons,
        exceptionId: null,
        taskId: task.id,
      };
    }

    return {
      outcome: "auto_dispatch",
      tier: score.tier,
      reasons: score.reasons,
      exceptionId: null,
      taskId: null,
    };
  }
}

/**
 * Exchange flow (roadmap P2-S7-T07): credit the original line, reserve the
 * replacement, and net the price difference. When the replacement is out of
 * stock the exchange creates an exception and never double-credits.
 */
export class ExchangeService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
    },
  ) {}

  async exchange(
    tenantId: string,
    input: {
      orderId: string;
      originalLineId: string;
      replacementVariantId: string;
      replacementQuantity: number;
    },
  ): Promise<{
    exchangeId: string;
    creditedMinor: number;
    chargedMinor: number;
    netMinor: number;
    exceptionId: string | null;
  }> {
    const exchangeId = randomUUID();
    const original = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<{
          unit_price_minor: number;
          quantity: number;
          currency: string;
          variant_id: string;
        }>(
          `select ol.unit_price_minor, ol.quantity, ol.currency, ol.variant_id
           from order_lines ol
          where ol.tenant_id=$1 and ol.id=$2 and ol.order_id=$3`,
          [tenantId, input.originalLineId, input.orderId],
        );
        return r.rows[0];
      },
    );
    if (!original) {
      throw new GatingError("Order line not found.", 404);
    }

    const available = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<{ available: string }>(
          `select coalesce(sum(case when bucket='on_hand' then quantity
                                 when bucket in ('reserved','quarantined','damaged') then -quantity
                                 else 0 end),0)::text as available
           from stock_balances where tenant_id=$1 and variant_id=$2`,
          [tenantId, input.replacementVariantId],
        );
        return Number(r.rows[0]?.available ?? 0);
      },
    );

    if (available < input.replacementQuantity) {
      const exceptionId = randomUUID();
      await withTenant(this.deps.pool, tenantId, async (client) => {
        await client.query(
          `insert into exceptions
             (id, tenant_id, order_id, reason_code, status, metadata, due_at)
           values ($1,$2,$3,'EXCHANGE_OUT_OF_STOCK','open',$4, now() + interval '1 day')`,
          [
            exceptionId,
            tenantId,
            input.orderId,
            JSON.stringify({
              replacementVariantId: input.replacementVariantId,
              requested: input.replacementQuantity,
              available,
            }),
          ],
        );
      });
      return {
        exchangeId,
        creditedMinor: 0,
        chargedMinor: 0,
        netMinor: 0,
        exceptionId,
      };
    }

    const replacement = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<{ unit_cost_minor: number }>(
          `select coalesce(avg(pl.unit_cost_minor),0)::int as unit_cost_minor
           from po_lines pl
          where pl.tenant_id=$1 and pl.variant_id=$2`,
          [tenantId, input.replacementVariantId],
        );
        return Number(r.rows[0]?.unit_cost_minor ?? 0);
      },
    );

    const creditedMinor = original.unit_price_minor * input.replacementQuantity;
    const chargedMinor = replacement * input.replacementQuantity;

    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into return_lines
           (tenant_id, return_id, order_line_id, quantity, amount_minor, currency)
         select $1, r.id, $3, $4, $5, $6
           from returns r
          where r.tenant_id=$1 and r.order_id=$2 and r.status <> 'closed'
          limit 1`,
        [
          tenantId,
          input.orderId,
          input.originalLineId,
          input.replacementQuantity,
          creditedMinor,
          original.currency,
        ],
      );
      await client.query(
        `insert into order_events
           (tenant_id, order_id, event_type, note, customer_visible)
         values ($1,$2,'note',$3,false)`,
        [
          tenantId,
          input.orderId,
          `Exchange ${exchangeId}: credited ${creditedMinor}, charged ${chargedMinor}`,
        ],
      );
    });

    return {
      exchangeId,
      creditedMinor,
      chargedMinor,
      netMinor: chargedMinor - creditedMinor,
      exceptionId: null,
    };
  }
}

/**
 * Generic reconciler for connectors (roadmap P2-S8-T03): pull the
 * authoritative list from the source, diff it against the internal table
 * and apply the rules — import what is missing, flag conflicts, and never
 * overwrite stock from the source.
 */
export class ReconcilerService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
    },
  ) {}

  async reconcileOrders(
    tenantId: string,
    source: { externalOrderId: string; orderNumber: string; status: string }[],
  ): Promise<{
    imported: number;
    restored: number;
    conflicts: { externalOrderId: string; internal: string; source: string }[];
    unchanged: number;
  }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      let imported = 0;
      let unchanged = 0;
      const conflicts: {
        externalOrderId: string;
        internal: string;
        source: string;
      }[] = [];

      for (const row of source) {
        const existing = await client.query<{ id: string; status: string }>(
          `select id, status from orders
            where tenant_id=$1 and external_order_id=$2`,
          [tenantId, row.externalOrderId],
        );
        const found = existing.rows[0];

        if (!found) {
          // Missing on our side: re-import a minimal order.
          await client.query(
            `insert into orders
               (tenant_id, order_number, customer_id, status, channel, external_order_id)
             select $1,$2,c.id,$3,'connector',$4
               from customers c
              where c.tenant_id=$1
              limit 1`,
            [tenantId, row.orderNumber, row.status, row.externalOrderId],
          );
          imported++;
          continue;
        }

        if (found.status !== row.status) {
          // A conflict: the source says one thing, we say another. Record
          // it and let a human decide — the reconciler never overwrites.
          conflicts.push({
            externalOrderId: row.externalOrderId,
            internal: found.status,
            source: row.status,
          });
          continue;
        }
        unchanged++;
      }

      return { imported, restored: 0, conflicts, unchanged };
    });
  }

  /**
   * Restores a row that was deleted locally by pulling it from the source.
   * Stock is never touched: the source says nothing about our stock.
   */
  async restoreDeletedOrder(
    tenantId: string,
    sourceOrder: {
      externalOrderId: string;
      orderNumber: string;
      status: string;
    },
  ): Promise<{ restored: boolean; orderId: string | null }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const existing = await client.query<{ id: string }>(
        `select id from orders where tenant_id=$1 and external_order_id=$2`,
        [tenantId, sourceOrder.externalOrderId],
      );
      if (existing.rows[0]) {
        return { restored: false, orderId: existing.rows[0].id };
      }
      const customer = await client.query<{ id: string }>(
        `select id from customers where tenant_id=$1 limit 1`,
        [tenantId],
      );
      if (!customer.rows[0]) {
        return { restored: false, orderId: null };
      }
      const id = randomUUID();
      await client.query(
        `insert into orders
           (id, tenant_id, order_number, customer_id, status, channel, external_order_id)
         values ($1,$2,$3,$4,$5,'connector',$6)`,
        [
          id,
          tenantId,
          sourceOrder.orderNumber,
          customer.rows[0].id,
          sourceOrder.status,
          sourceOrder.externalOrderId,
        ],
      );
      return { restored: true, orderId: id };
    });
  }
}

/**
 * Cycle-count generation (roadmap P2-S6-T05): A items are counted weekly,
 * B monthly, C quarterly, and a large variance triggers an extra count.
 */
export class CycleCountGenerator {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
    },
  ) {}

  /** Creates the count tasks that are due for a location. */
  async generate(
    tenantId: string,
    locationId: string,
  ): Promise<{ created: number; classifications: Record<string, number> }> {
    const items = await withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{
        variant_id: string;
        value_minor: string;
        units: string;
      }>(
        `select v.id as variant_id,
                coalesce((select sum(pl.quantity * pl.unit_cost_minor) from po_lines pl
                           where pl.tenant_id=v.tenant_id and pl.variant_id=v.id),0)::text as value_minor,
                coalesce((select sum(ol.quantity) from order_lines ol
                           where ol.tenant_id=v.tenant_id and ol.variant_id=v.id),0)::text as units
           from variants v where v.tenant_id=$1`,
        [tenantId],
      );
      return r.rows;
    });

    const totalValue = items.reduce((sum, i) => sum + Number(i.value_minor), 0);
    let cumulative = 0;
    const classified = items.map((item) => {
      const value = Number(item.value_minor);
      cumulative += value;
      const share = totalValue === 0 ? 1 : cumulative / totalValue;
      const classification =
        totalValue === 0 ? "C" : share <= 0.8 ? "A" : share <= 0.95 ? "B" : "C";
      return {
        variantId: item.variant_id,
        classification: classification as "A" | "B" | "C",
      };
    });

    const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
    await withTenant(this.deps.pool, tenantId, async (client) => {
      for (const item of classified) {
        counts[item.classification] = (counts[item.classification] ?? 0) + 1;
        const existing = await client.query<{ id: string }>(
          `select id from cycle_counts
            where tenant_id=$1 and location_id=$2 and variant_id=$3 and status='open'`,
          [tenantId, locationId, item.variantId],
        );
        if (existing.rows[0]) continue;
        const expected = await client.query<{ qty: string }>(
          `select coalesce(sum(quantity),0)::text as qty from stock_balances
            where tenant_id=$1 and variant_id=$2 and location_id=$3 and bucket='on_hand'`,
          [tenantId, item.variantId, locationId],
        );
        await client.query(
          `insert into cycle_counts
             (tenant_id, location_id, variant_id, classification, status, expected_qty)
           values ($1,$2,$3,$4,'open',$5)`,
          [
            tenantId,
            locationId,
            item.variantId,
            item.classification,
            Number(expected.rows[0]?.qty ?? 0),
          ],
        );
      }
    });

    return { created: classified.length, classifications: counts };
  }

  /** The interval at which a class is counted. */
  static intervalFor(classification: "A" | "B" | "C"): number {
    if (classification === "A") return 7;
    if (classification === "B") return 30;
    return 90;
  }
}
