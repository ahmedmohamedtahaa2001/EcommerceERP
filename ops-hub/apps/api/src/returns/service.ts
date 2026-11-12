import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

import { StockService } from "../stock/service";
import type { MovementActor } from "../stock/types";

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

export class ReturnsError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "ReturnsError";
    this.statusCode = statusCode;
  }
}

const RETURN_WINDOW_DAYS = 14;
const FINAL_SALE_REASON = "FINAL_SALE";

/**
 * Returns, dispositions and refunds (roadmap Sprint 7).
 *
 * Eligibility is checked before a return is created; the refund sits behind
 * a four-eyes approval gate and is only released once the return has been
 * received.
 */
export class ReturnsService {
  constructor(
    private readonly deps: {
      pool: Pool;
      stock: StockService;
      clock: { now(): Date };
      /** Refunds above this amount need a second approver. */
      refundApprovalThresholdMinor?: number;
      /** Refunds can only be released after the return is received. */
      requireReturnReceipt?: boolean;
    },
  ) {}

  async createReturn(
    tenantId: string,
    input: {
      orderId: string;
      reasonCode: string;
      lines: { orderLineId: string; quantity: number }[];
    },
  ): Promise<{ id: string; status: ReturnStatus; amountMinor: number }> {
    if (input.lines.length === 0) {
      throw new ReturnsError("A return needs at least one line.");
    }

    const order = await withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{ created_at: Date; status: string }>(
        `select created_at, status from orders where tenant_id=$1 and id=$2`,
        [tenantId, input.orderId],
      );
      return r.rows[0];
    });
    if (!order) throw new ReturnsError("Order not found.", 404);
    if (order.status === "cancelled" || order.status === "returned") {
      throw new ReturnsError(
        `An order in state "${order.status}" cannot be returned.`,
      );
    }

    const windowDays = RETURN_WINDOW_DAYS;
    const ageMs =
      this.deps.clock.now().getTime() - new Date(order.created_at).getTime();
    if (ageMs > windowDays * 24 * 3600 * 1000) {
      throw new ReturnsError(
        `The return window of ${windowDays} days has passed for this order.`,
      );
    }
    if (input.reasonCode === FINAL_SALE_REASON) {
      throw new ReturnsError("Final-sale items are not eligible for return.");
    }

    const lines = await withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{
        id: string;
        order_line_id: string;
        quantity: number;
        amount_minor: number;
        currency: string;
      }>(
        `select ol.id, ol.id as order_line_id, ol.quantity, ol.unit_price_minor as amount_minor, ol.currency
           from order_lines ol
          where ol.tenant_id=$1 and ol.id = any($2::uuid[])`,
        [tenantId, input.lines.map((l) => l.orderLineId)],
      );
      return r.rows;
    });

    const byId = new Map(lines.map((l) => [l.id, l]));
    for (const requested of input.lines) {
      const line = byId.get(requested.orderLineId);
      if (!line) {
        throw new ReturnsError(
          `Order line ${requested.orderLineId} is not part of this order.`,
        );
      }
      if (requested.quantity > line.quantity) {
        throw new ReturnsError(
          `Cannot return ${requested.quantity} unit(s) of a line with ${line.quantity}.`,
        );
      }
    }

    const returnId = randomUUID();
    const amountMinor = input.lines.reduce((sum, requested) => {
      const line = byId.get(requested.orderLineId)!;
      return sum + line.amount_minor * requested.quantity;
    }, 0);

    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into returns (id, tenant_id, order_id, status, reason_code)
         values ($1,$2,$3,'requested',$4)`,
        [returnId, tenantId, input.orderId, input.reasonCode],
      );
      for (const requested of input.lines) {
        const line = byId.get(requested.orderLineId)!;
        await client.query(
          `insert into return_lines
             (tenant_id, return_id, order_line_id, quantity, amount_minor, currency)
           values ($1,$2,$3,$4,$5,$6)`,
          [
            tenantId,
            returnId,
            requested.orderLineId,
            requested.quantity,
            line.amount_minor * requested.quantity,
            line.currency,
          ],
        );
      }
    });

    return { id: returnId, status: "requested", amountMinor };
  }

  async getReturn(
    tenantId: string,
    returnId: string,
  ): Promise<{
    id: string;
    orderId: string;
    status: ReturnStatus;
    reasonCode: string;
    disposition: Disposition | null;
    amountMinor: number;
    lines: { orderLineId: string; quantity: number; amountMinor: number }[];
  }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `select * from returns where tenant_id=$1 and id=$2`,
        [tenantId, returnId],
      );
      const row = r.rows[0];
      if (!row) throw new ReturnsError("Return not found.", 404);
      const lines = await client.query<{
        order_line_id: string;
        quantity: number;
        amount_minor: number;
      }>(
        `select order_line_id, quantity, amount_minor from return_lines
          where tenant_id=$1 and return_id=$2`,
        [tenantId, returnId],
      );
      return {
        id: String(row.id),
        orderId: String(row.order_id),
        status: row.status as ReturnStatus,
        reasonCode: String(row.reason_code),
        disposition: (row.disposition as Disposition | null) ?? null,
        amountMinor: lines.rows.reduce((sum, l) => sum + l.amount_minor, 0),
        lines: lines.rows.map((l) => ({
          orderLineId: l.order_line_id,
          quantity: l.quantity,
          amountMinor: l.amount_minor,
        })),
      };
    });
  }

  /** Moves the return along its lifecycle. */
  async transition(
    tenantId: string,
    returnId: string,
    status: ReturnStatus,
  ): Promise<{ id: string; status: ReturnStatus }> {
    const allowed: Record<ReturnStatus, ReturnStatus[]> = {
      requested: ["approved"],
      approved: ["label_issued"],
      label_issued: ["in_transit_back"],
      in_transit_back: ["received"],
      received: ["inspected"],
      inspected: ["dispositioned"],
      dispositioned: ["closed"],
      closed: [],
    };
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const current = await client.query<{ status: string }>(
        `select status from returns where tenant_id=$1 and id=$2`,
        [tenantId, returnId],
      );
      const row = current.rows[0];
      if (!row) throw new ReturnsError("Return not found.", 404);
      const from = row.status as ReturnStatus;
      if (!allowed[from].includes(status)) {
        throw new ReturnsError(
          `Cannot move a return from ${from} to ${status}.`,
        );
      }
      await client.query(
        `update returns set status=$3, updated_at=now() where tenant_id=$1 and id=$2`,
        [tenantId, returnId, status],
      );
      return { id: returnId, status };
    });
  }

  /** Receiving a return applies the disposition as a stock movement. */
  async applyDisposition(
    tenantId: string,
    returnId: string,
    input: {
      disposition: Disposition;
      locationId: string;
      variantIdByLine: Record<string, string>;
    },
    actor: MovementActor | null,
  ): Promise<{ disposition: Disposition; movements: number }> {
    const ret = await this.getReturn(tenantId, returnId);
    if (ret.status !== "inspected") {
      throw new ReturnsError("Only an inspected return can be dispositioned.");
    }
    let movements = 0;
    for (const line of ret.lines) {
      const variantId = input.variantIdByLine[line.orderLineId];
      if (!variantId) continue;
      const bucket =
        input.disposition === "restock"
          ? "on_hand"
          : input.disposition === "discard"
            ? "damaged"
            : "on_hand";
      const delta =
        input.disposition === "discard" ? line.quantity : line.quantity;
      await this.deps.stock.recordMovement(
        {
          variantId,
          locationId: input.locationId,
          bucket,
          delta,
          reason: `RETURN_${input.disposition.toUpperCase()}`,
          reference: returnId,
        },
        tenantId,
        actor,
      );
      movements++;
    }
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `update returns set status='dispositioned', disposition=$3, updated_at=now()
          where tenant_id=$1 and id=$2`,
        [tenantId, returnId, input.disposition],
      );
    });
    return { disposition: input.disposition, movements };
  }

  /** Requests a refund. Above the threshold it needs a second approver. */
  async requestRefund(
    tenantId: string,
    input: { orderId: string; returnId?: string | null; amountMinor: number },
    requestedBy: string | null,
  ): Promise<{
    id: string;
    status: string;
    amountMinor: number;
    needsApproval: boolean;
  }> {
    const threshold = this.deps.refundApprovalThresholdMinor ?? 0;
    const needsApproval = input.amountMinor > threshold;
    const id = randomUUID();
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into refunds
           (id, tenant_id, order_id, return_id, amount_minor, status, requested_by)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          tenantId,
          input.orderId,
          input.returnId ?? null,
          input.amountMinor,
          needsApproval ? "pending_approval" : "approved",
          requestedBy,
        ],
      );
      if (!needsApproval) {
        await client.query(
          `update refunds set approved_at=now() where tenant_id=$1 and id=$2`,
          [tenantId, id],
        );
      }
    });
    return {
      id,
      status: needsApproval ? "pending_approval" : "approved",
      amountMinor: input.amountMinor,
      needsApproval,
    };
  }

  /**
   * Approves a refund. The approver must not be the requester (four-eyes),
   * and a refund that requires a return receipt cannot be released before
   * the return has been received.
   */
  async approveRefund(
    tenantId: string,
    refundId: string,
    approverId: string,
  ): Promise<{ id: string; status: string }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{
        requested_by: string | null;
        status: string;
        return_id: string | null;
      }>(
        `select requested_by, status, return_id from refunds where tenant_id=$1 and id=$2`,
        [tenantId, refundId],
      );
      const row = r.rows[0];
      if (!row) throw new ReturnsError("Refund not found.", 404);
      if (row.status !== "pending_approval") {
        throw new ReturnsError("This refund is not waiting for approval.");
      }
      if (row.requested_by && row.requested_by === approverId) {
        throw new ReturnsError(
          "A refund must be approved by someone other than the requester.",
        );
      }
      if (this.deps.requireReturnReceipt !== false && row.return_id) {
        const ret = await client.query<{ status: string }>(
          `select status from returns where tenant_id=$1 and id=$2`,
          [tenantId, row.return_id],
        );
        const status = ret.rows[0]?.status;
        const received = ["received", "inspected", "dispositioned", "closed"];
        if (!status || !received.includes(status)) {
          throw new ReturnsError(
            "The refund cannot be released before the return is received.",
          );
        }
      }
      await client.query(
        `update refunds set status='approved', approved_by=$3, approved_at=now()
          where tenant_id=$1 and id=$2`,
        [tenantId, refundId, approverId],
      );
      return { id: refundId, status: "approved" };
    });
  }
}
