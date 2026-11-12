import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export type RiskTier = "low" | "medium" | "high";
export type CodOutcome = "confirmed" | "changed" | "cancelled" | "no_answer";
export type ReturnStatus =
  | "requested"
  | "approved"
  | "label_issued"
  | "in_transit_back"
  | "received"
  | "inspected"
  | "dispositioned"
  | "closed";
export type Disposition =
  "restock" | "refurbish" | "outlet" | "liquidate" | "discard";

export class CodError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "CodError";
    this.statusCode = statusCode;
  }
}

/**
 * Parses a customer's reply to a confirmation request. Arabic and English
 * "yes"/"no" are accepted, case-insensitively.
 */
export function parseConfirmationReply(text: string): CodOutcome | null {
  const normalized = text.trim().toLowerCase();
  if (
    [
      "yes",
      "y",
      "yeah",
      "yep",
      "ok",
      "okay",
      "sure",
      "ايوه",
      "أيوه",
      "ايوة",
      "نعم",
      "تمام",
    ].includes(normalized)
  ) {
    return "confirmed";
  }
  if (
    [
      "no",
      "n",
      "nope",
      "لا",
      "لأ",
      "مش",
      "مفيش",
      " canceling",
      "cancel",
      "الغاء",
      "إلغاء",
    ].includes(normalized)
  ) {
    return "cancelled";
  }
  return null;
}

export interface RiskScore {
  tier: RiskTier;
  reasons: string[];
}

/**
 * Rule-based risk scoring (roadmap P2-S7-T02). Deterministic: the same
 * inputs always produce the same tier and the same reasons.
 */
export function scoreRisk(input: {
  priorRefusals: number;
  priorRtos: number;
  governorateRtoRate: number;
  orderValueMinor: number;
  averageOrderValueMinor: number;
  addressQuality: "complete" | "partial" | "missing";
  confirmationOutcome: CodOutcome | null;
}): RiskScore {
  const reasons: string[] = [];
  let points = 0;

  if (input.priorRefusals > 0) {
    points += input.priorRefusals * 25;
    reasons.push(`${input.priorRefusals} prior refusal(s) on this phone`);
  }
  if (input.priorRtos > 0) {
    points += input.priorRtos * 25;
    reasons.push(`${input.priorRtos} prior return-to-sender on this phone`);
  }
  if (input.governorateRtoRate > 0.2) {
    points += 20;
    reasons.push(
      `Governorate return rate ${Math.round(input.governorateRtoRate * 100)}%`,
    );
  }
  if (
    input.averageOrderValueMinor > 0 &&
    input.orderValueMinor > input.averageOrderValueMinor * 2
  ) {
    points += 15;
    reasons.push("Order value is more than double the customer average");
  }
  if (input.addressQuality !== "complete") {
    points += input.addressQuality === "missing" ? 40 : 25;
    reasons.push(
      input.addressQuality === "missing"
        ? "Address is incomplete"
        : "Address is only partially complete",
    );
  }
  if (input.confirmationOutcome === "cancelled") {
    points += 40;
    reasons.push("Customer cancelled during confirmation");
  } else if (input.confirmationOutcome === "no_answer") {
    points += 10;
    reasons.push("Customer did not answer the confirmation request");
  }

  const tier: RiskTier =
    points >= 60 ? "high" : points >= 25 ? "medium" : "low";
  return { tier, reasons };
}

export interface CodServiceDeps {
  pool: Pool;
  clock: { now(): Date };
  /** Tenant-level thresholds; below `medium` is low, below `high` is medium. */
  thresholds?: { medium: number; high: number };
}

export class CodService {
  constructor(private readonly deps: CodServiceDeps) {}

  /** Creates a confirmation task for a COD order. */
  async createTask(
    tenantId: string,
    input: {
      orderId: string;
      channel?: "whatsapp" | "sms" | "call";
      dueAt?: Date;
    },
  ): Promise<{ id: string; status: string; attempts: number; dueAt: Date }> {
    const id = randomUUID();
    const dueAt =
      input.dueAt ??
      new Date(this.deps.clock.now().getTime() + 24 * 3600 * 1000);
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into cod_tasks (id, tenant_id, order_id, status, channel, due_at)
         values ($1,$2,$3,'pending',$4,$5)`,
        [id, tenantId, input.orderId, input.channel ?? "whatsapp", dueAt],
      );
    });
    return { id, status: "pending", attempts: 0, dueAt };
  }

  /** Records one attempt. After `maxNoAnswers` unanswered attempts the task
   * is handed to an agent queue. */
  async recordAttempt(
    tenantId: string,
    taskId: string,
    input: {
      channel: "whatsapp" | "sms" | "call";
      outcome: CodOutcome;
      response?: string;
    },
    maxNoAnswers = 3,
  ): Promise<{
    taskId: string;
    attempts: number;
    status: string;
    outcome: CodOutcome | null;
  }> {
    const result = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const task = await client.query<{
          id: string;
          attempts: number;
          status: string;
        }>(
          `select id, attempts, status from cod_tasks where tenant_id=$1 and id=$2`,
          [tenantId, taskId],
        );
        const row = task.rows[0];
        if (!row) throw new CodError("Confirmation task not found.", 404);
        if (row.status === "resolved") {
          throw new CodError("This task is already resolved.");
        }

        const attempts = row.attempts + 1;
        const resolved = input.outcome !== "no_answer";
        const status = resolved
          ? "resolved"
          : attempts >= maxNoAnswers
            ? "needs_agent"
            : "pending";
        const outcome = resolved ? input.outcome : null;

        await client.query(
          `insert into cod_attempts (tenant_id, task_id, channel, outcome, response)
         values ($1,$2,$3,$4,$5)`,
          [
            tenantId,
            taskId,
            input.channel,
            input.outcome,
            input.response ?? null,
          ],
        );
        await client.query(
          `update cod_tasks set attempts=$3, status=$4, outcome=$5,
                resolved_at = case when $4='resolved' then now() else null end
          where tenant_id=$1 and id=$2`,
          [tenantId, taskId, attempts, status, outcome],
        );
        return { taskId, attempts, status, outcome };
      },
    );
    return result;
  }

  async listTasks(
    tenantId: string,
    filter: { status?: string; orderId?: string } = {},
  ): Promise<
    {
      id: string;
      orderId: string;
      status: string;
      channel: string;
      attempts: number;
      outcome: string | null;
      dueAt: Date;
    }[]
  > {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.status) {
        params.push(filter.status);
        conditions.push(`status = $${params.length}`);
      }
      if (filter.orderId) {
        params.push(filter.orderId);
        conditions.push(`order_id = $${params.length}`);
      }
      const r = await client.query<Record<string, unknown>>(
        `select * from cod_tasks where ${conditions.join(" and ")} order by created_at desc`,
        params,
      );
      return r.rows.map((row) => ({
        id: String(row.id),
        orderId: String(row.order_id),
        status: String(row.status),
        channel: String(row.channel),
        attempts: Number(row.attempts),
        outcome: (row.outcome as string | null) ?? null,
        dueAt: new Date(row.due_at as string),
      }));
    });
  }

  /** Scores an order and stores the result. */
  async scoreOrder(tenantId: string, orderId: string): Promise<RiskScore> {
    const input = await this.collectRiskInputs(tenantId, orderId);
    const score = scoreRisk(input);
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into risk_scores (tenant_id, order_id, tier, reasons)
         values ($1,$2,$3,$4)`,
        [tenantId, orderId, score.tier, JSON.stringify(score.reasons)],
      );
    });
    return score;
  }

  async getLatestScore(
    tenantId: string,
    orderId: string,
  ): Promise<RiskScore | null> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{ tier: string; reasons: string[] }>(
        `select tier, reasons from risk_scores
          where tenant_id=$1 and order_id=$2
          order by created_at desc limit 1`,
        [tenantId, orderId],
      );
      const row = r.rows[0];
      return row
        ? { tier: row.tier as RiskTier, reasons: row.reasons ?? [] }
        : null;
    });
  }

  private async collectRiskInputs(
    tenantId: string,
    orderId: string,
  ): Promise<Parameters<typeof scoreRisk>[0]> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const order = await client.query<{
        customer_id: string;
        amount_minor: number;
        governorate_code: string | null;
        line1: string | null;
        city: string | null;
      }>(
        `select o.customer_id,
                coalesce((select sum(p.amount_minor) from payments p
                           where p.tenant_id=o.tenant_id and p.order_id=o.id),0)::int as amount_minor,
                a.governorate_code, a.line1, a.city
           from orders o left join addresses a on a.id = o.address_id
          where o.tenant_id=$1 and o.id=$2`,
        [tenantId, orderId],
      );
      const o = order.rows[0];
      if (!o) throw new CodError("Order not found.", 404);

      const history = await client.query<{
        prior_refusals: string;
        prior_rtos: string;
        avg_amount: string;
      }>(
        `select
           count(*) filter (where p.status='failed')::text as prior_refusals,
           count(*) filter (where o.status='returned')::text as prior_rtos,
           coalesce(avg(p.amount_minor),0)::text as avg_amount
         from orders o join payments p on p.order_id = o.id and p.tenant_id = o.tenant_id
         where o.tenant_id=$1 and o.customer_id=$2 and o.id <> $3`,
        [tenantId, o.customer_id, orderId],
      );
      const h = history.rows[0];

      const gov = await client.query<{ rto_rate: string }>(
        `select count(*) filter (where o.status='returned')::float /
                 greatest(count(*),1) as rto_rate
           from orders o join addresses a on a.id=o.address_id
          where o.tenant_id=$1 and a.governorate_code=$2`,
        [tenantId, o.governorate_code ?? ""],
      );

      const addressQuality: "complete" | "partial" | "missing" = !o.line1
        ? "missing"
        : o.governorate_code && o.city
          ? "complete"
          : "partial";

      return {
        priorRefusals: Number(h?.prior_refusals ?? 0),
        priorRtos: Number(h?.prior_rtos ?? 0),
        governorateRtoRate: Number(gov.rows[0]?.rto_rate ?? 0),
        orderValueMinor: o.amount_minor,
        averageOrderValueMinor: Number(h?.avg_amount ?? 0),
        addressQuality,
        confirmationOutcome: null,
      };
    });
  }
}
