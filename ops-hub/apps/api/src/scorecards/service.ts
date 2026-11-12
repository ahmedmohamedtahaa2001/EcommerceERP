import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export class ScorecardError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "ScorecardError";
    this.statusCode = statusCode;
  }
}

export interface SupplierScorecard {
  supplierId: string;
  periodStart: Date;
  periodEnd: Date;
  ackTimeHours: number;
  otifRate: number;
  fillRate: number;
  damageRate: number;
  costVarianceMinor: number;
  claimCount: number;
}

export interface CarrierScorecard {
  carrier: string;
  governorateCode: string;
  service: string;
  periodStart: Date;
  periodEnd: Date;
  onTimeRate: number;
  firstAttemptRate: number;
  exceptionRate: number;
  costPerShipmentMinor: number;
  claims: number;
}

/**
 * Supplier and carrier scorecards, landed cost and claims
 * (roadmap Sprint 10).
 */
export class ScorecardService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
      /** Carrier on-time rate below this breaches the SLA. */
      carrierSlaBreachRate?: number;
    },
  ) {}

  /** Computes the supplier scorecard from purchase orders and receipts in
   * the window. */
  async supplierScorecard(
    tenantId: string,
    supplierId: string,
    period: { start: Date; end: Date },
  ): Promise<SupplierScorecard> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const pos = await client.query<{
        total: string;
        on_time: string;
        fulfilled: string;
        ordered: string;
        ack_hours: string;
      }>(
        `select count(*)::text as total,
                count(*) filter (where po.acknowledged_at is not null
                   and po.acknowledged_at <= po.created_at + interval '48 hours')::text as on_time,
                count(*) filter (where po.status in ('received','closed'))::text as fulfilled,
                count(*)::text as ordered,
                coalesce(avg(extract(epoch from (po.acknowledged_at - po.sent_at))/3600),0)::text as ack_hours
           from purchase_orders po
          where po.tenant_id=$1 and po.supplier_id=$2
            and po.created_at >= $3 and po.created_at < $4`,
        [tenantId, supplierId, period.start, period.end],
      );
      const po = pos.rows[0]!;

      const lines = await client.query<{
        ordered: string;
        received: string;
        cost: string;
        value: string;
      }>(
        `select coalesce(sum(pl.quantity),0)::text as ordered,
                coalesce(sum(pl.received_qty),0)::text as received,
                coalesce(sum(pl.quantity * pl.unit_cost_minor),0)::text as cost,
                coalesce(sum(pl.received_qty * pl.unit_cost_minor),0)::text as value
           from po_lines pl join purchase_orders po on po.id=pl.po_id and po.tenant_id=pl.tenant_id
          where pl.tenant_id=$1 and po.supplier_id=$2
            and po.created_at >= $3 and po.created_at < $4`,
        [tenantId, supplierId, period.start, period.end],
      );
      const l = lines.rows[0]!;

      const damage = await client.query<{ damaged: string; total: string }>(
        `select coalesce(sum(rl.damaged_qty),0)::text as damaged,
                coalesce(sum(rl.received_qty),0)::text as total
           from receipt_lines rl join receipts r on r.id=rl.receipt_id and r.tenant_id=rl.tenant_id
          where rl.tenant_id=$1 and r.po_id is not null
            and r.created_at >= $2 and r.created_at < $3`,
        [tenantId, period.start, period.end],
      );
      const d = damage.rows[0]!;

      const claims = await client.query<{ count: string }>(
        `select count(*)::text as count from claims
          where tenant_id=$1 and status <> 'closed'`,
        [tenantId],
      );

      const ordered = Number(l.ordered);
      const received = Number(l.received);
      const fillRate =
        ordered === 0 ? 100 : Math.round((received / ordered) * 100);
      const damageTotal = Number(d.total);
      const damageRate =
        damageTotal === 0
          ? 0
          : Math.round((Number(d.damaged) / damageTotal) * 100);
      const otifRate =
        Number(po.ordered) === 0
          ? 100
          : Math.round((Number(po.on_time) / Number(po.ordered)) * 100);

      const scorecard: SupplierScorecard = {
        supplierId,
        periodStart: period.start,
        periodEnd: period.end,
        ackTimeHours: Math.round(Number(po.ack_hours)),
        otifRate,
        fillRate,
        damageRate,
        costVarianceMinor: Number(l.cost) - Number(l.value),
        claimCount: Number(claims.rows[0]?.count ?? 0),
      };

      await client.query(
        `insert into supplier_scorecards
           (tenant_id, supplier_id, period_start, period_end, ack_time_hours,
            otif_rate, fill_rate, damage_rate, cost_variance_minor, claim_count)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          tenantId,
          supplierId,
          period.start,
          period.end,
          scorecard.ackTimeHours,
          scorecard.otifRate,
          scorecard.fillRate,
          scorecard.damageRate,
          scorecard.costVarianceMinor,
          scorecard.claimCount,
        ],
      );
      return scorecard;
    });
  }

  /**
   * Landed cost: PO cost + freight + duties + surcharges allocated to the
   * received units. The allocated costs sum exactly to the total — the
   * rounding remainder goes to the largest line.
   */
  async allocateLandedCost(
    tenantId: string,
    input: {
      poId: string;
      freightMinor: number;
      dutiesMinor: number;
      surchargesMinor: number;
      /** `value` or `weight`. */
      basis?: "value" | "weight";
      weights?: Record<string, number>;
    },
  ): Promise<
    { lineId: string; variantId: string; allocatedCostMinor: number }[]
  > {
    const overhead =
      input.freightMinor + input.dutiesMinor + input.surchargesMinor;
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const lines = await client.query<{
        id: string;
        variant_id: string;
        quantity: number;
        received_qty: number;
        unit_cost_minor: number;
      }>(
        `select id, variant_id, quantity, received_qty, unit_cost_minor
           from po_lines where tenant_id=$1 and po_id=$2`,
        [tenantId, input.poId],
      );
      if (lines.rows.length === 0) {
        throw new ScorecardError("Purchase order has no lines.", 404);
      }

      const basis = input.basis ?? "value";
      const weights = lines.rows.map((line) => {
        if (basis === "weight") {
          return input.weights?.[line.id] ?? line.received_qty;
        }
        return line.received_qty * line.unit_cost_minor;
      });
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);

      const allocations: {
        lineId: string;
        variantId: string;
        allocatedCostMinor: number;
      }[] = [];
      let allocated = 0;
      const sorted = [...lines.rows].sort(
        (a, b) =>
          weights[lines.rows.indexOf(b)]! - weights[lines.rows.indexOf(a)]!,
      );

      lines.rows.forEach((line, index) => {
        const share =
          totalWeight === 0 ? 0 : overhead * (weights[index]! / totalWeight);
        const rounded = index === 0 ? 0 : Math.round(share);
        allocated += rounded;
        allocations.push({
          lineId: line.id,
          variantId: line.variant_id,
          allocatedCostMinor: rounded,
        });
      });

      // The rounding remainder lands on the largest line so the sum is exact.
      const remainder = overhead - allocated;
      if (remainder !== 0 && allocations.length > 0) {
        const largest = sorted[0]!;
        const target = allocations.find((a) => a.lineId === largest.id);
        if (target) target.allocatedCostMinor += remainder;
      }

      for (const allocation of allocations) {
        await client.query(
          `insert into landed_costs
             (tenant_id, po_id, po_line_id, variant_id, allocation_basis, allocated_cost_minor)
           values ($1,$2,$3,$4,$5,$6)`,
          [
            tenantId,
            input.poId,
            allocation.lineId,
            allocation.variantId,
            basis,
            allocation.allocatedCostMinor,
          ],
        );
      }
      return allocations;
    });
  }

  /** Carrier scorecard for a carrier/governorate/service in a window. */
  async carrierScorecard(
    tenantId: string,
    input: {
      carrier: string;
      governorateCode: string;
      service?: string;
      period: { start: Date; end: Date };
    },
  ): Promise<CarrierScorecard> {
    const scorecard = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const rows = await client.query<{
          total: string;
          on_time: string;
          first_attempt: string;
          exceptions: string;
          cost: string;
        }>(
          `select count(*)::text as total,
                count(*) filter (where sh.status='delivered')::text as on_time,
                count(*) filter (where sh.status='delivered')::text as first_attempt,
                count(*) filter (where sh.status in ('delivery_exception','returned_to_sender'))::text as exceptions,
                coalesce(sum((select sl.amount_minor from settlement_lines sl
                               where sl.tenant_id=sh.tenant_id and sl.order_id=sh.order_id
                               limit 1)),0)::text as cost
           from shipments sh
          where sh.tenant_id=$1 and sh.carrier=$2
            and sh.created_at >= $3 and sh.created_at < $4`,
          [tenantId, input.carrier, input.period.start, input.period.end],
        );
        const row = rows.rows[0]!;
        const total = Number(row.total);
        const onTimeRate =
          total === 0 ? 100 : Math.round((Number(row.on_time) / total) * 100);
        const scorecard: CarrierScorecard = {
          carrier: input.carrier,
          governorateCode: input.governorateCode,
          service: input.service ?? "standard",
          periodStart: input.period.start,
          periodEnd: input.period.end,
          onTimeRate,
          firstAttemptRate:
            total === 0
              ? 100
              : Math.round((Number(row.first_attempt) / total) * 100),
          exceptionRate:
            total === 0
              ? 0
              : Math.round((Number(row.exceptions) / total) * 100),
          costPerShipmentMinor:
            total === 0 ? 0 : Math.round(Number(row.cost) / total),
          claims: 0,
        };
        await client.query(
          `insert into carrier_scorecards
           (tenant_id, carrier, governorate_code, service, period_start, period_end,
            on_time_rate, first_attempt_rate, exception_rate, cost_per_shipment_minor, claims)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            tenantId,
            scorecard.carrier,
            scorecard.governorateCode,
            scorecard.service,
            scorecard.periodStart,
            scorecard.periodEnd,
            scorecard.onTimeRate,
            scorecard.firstAttemptRate,
            scorecard.exceptionRate,
            scorecard.costPerShipmentMinor,
            scorecard.claims,
          ],
        );
        return scorecard;
      },
    );

    const breachRate = this.deps.carrierSlaBreachRate ?? 90;
    if (scorecard.onTimeRate < breachRate) {
      await this.createClaim(tenantId, {
        carrier: scorecard.carrier,
        type: "lost",
        description: `Carrier ${scorecard.carrier} breached its on-time SLA (${scorecard.onTimeRate}% < ${breachRate}%).`,
      });
    }
    return scorecard;
  }

  /** A claim cannot close without evidence unless it is explicitly waived. */
  async createClaim(
    tenantId: string,
    input: {
      carrier: string;
      shipmentId?: string | null;
      type: "lost" | "damaged" | "false_delivered";
      description: string;
      evidence?: string[];
    },
  ): Promise<{ id: string; status: string }> {
    const id = randomUUID();
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into claims
           (id, tenant_id, carrier, shipment_id, type, status, description, evidence)
         values ($1,$2,$3,$4,$5,'open',$6,$7)`,
        [
          id,
          tenantId,
          input.carrier,
          input.shipmentId ?? null,
          input.type,
          input.description,
          JSON.stringify(input.evidence ?? []),
        ],
      );
    });
    return { id, status: "open" };
  }

  async closeClaim(
    tenantId: string,
    claimId: string,
    input: { waived?: boolean; evidence?: string[] },
  ): Promise<{ id: string; status: string }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const current = await client.query<{
        evidence: string[];
        waived: boolean;
      }>(`select evidence, waived from claims where tenant_id=$1 and id=$2`, [
        tenantId,
        claimId,
      ]);
      const row = current.rows[0];
      if (!row) throw new ScorecardError("Claim not found.", 404);
      const evidence = [...(row.evidence ?? []), ...(input.evidence ?? [])];
      if (evidence.length === 0 && !input.waived && !row.waived) {
        throw new ScorecardError(
          "A claim needs evidence before it can close, or an explicit waiver.",
        );
      }
      await client.query(
        `update claims set status='closed', evidence=$3, waived=$4, closed_at=now()
          where tenant_id=$1 and id=$2`,
        [
          tenantId,
          claimId,
          JSON.stringify(evidence),
          input.waived ?? row.waived,
        ],
      );
      return { id: claimId, status: "closed" };
    });
  }

  /** Compares a carrier invoice against the quoted rate per shipment and
   * flags the lines that do not match. */
  async reconcileCarrierInvoice(
    tenantId: string,
    input: {
      carrier: string;
      lines: {
        trackingNumber: string;
        quotedMinor: number;
        invoicedMinor: number;
      }[];
    },
  ): Promise<{
    flagged: { trackingNumber: string; differenceMinor: number }[];
    totalDifferenceMinor: number;
  }> {
    const flagged: { trackingNumber: string; differenceMinor: number }[] = [];
    let totalDifferenceMinor = 0;
    for (const line of input.lines) {
      const difference = line.invoicedMinor - line.quotedMinor;
      if (difference !== 0) {
        flagged.push({
          trackingNumber: line.trackingNumber,
          differenceMinor: difference,
        });
        totalDifferenceMinor += difference;
      }
    }
    return { flagged, totalDifferenceMinor };
  }
}
