import { transition, type OrderState } from "@ops-hub/domain";

import {
  ExceptionAlreadyResolvedError,
  ExceptionNotFoundError,
  NotADuplicateExceptionError,
} from "./duplicate-errors";
import { defaultDueAt } from "./exception-sla";
import type { ExceptionStore, OrderStore, OrderWithDetails } from "./types";

/** Not yet tenant-configurable — there's no tenant-settings store for it yet. */
export const DUPLICATE_DETECTION_WINDOW_HOURS = 24;

export const DUPLICATE_SUSPECTED_REASON = "DUPLICATE_SUSPECTED";

export interface DuplicateFlag {
  duplicateOfOrderId: string;
  exceptionId: string;
  matchType: "external_order_id" | "sku_set";
}

export interface DuplicateReviewResult {
  action: "accept" | "merge";
  cancelledOrderId: string | null;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sameSkuSet(a: readonly string[], b: readonly string[]): boolean {
  const left = sortedUnique(a);
  const right = sortedUnique(b);
  return (
    left.length === right.length && left.every((sku, i) => sku === right[i])
  );
}

export class DuplicateDetectionService {
  constructor(
    private readonly store: OrderStore,
    private readonly exceptions: ExceptionStore,
    private readonly clock: { now(): Date },
  ) {}

  /**
   * Checks a just-created order against recent orders for the same
   * customer. Never blocks creation or merges anything itself — it only
   * flags (writes a DUPLICATE_SUSPECTED exception) so a human can review.
   */
  async checkAndFlag(
    tenantId: string,
    order: OrderWithDetails,
  ): Promise<DuplicateFlag | null> {
    if (order.order.externalOrderId) {
      const match = await this.store.findByExternalOrderId(
        tenantId,
        order.order.channel,
        order.order.externalOrderId,
        order.order.id,
      );
      if (match) {
        return this.flag(
          tenantId,
          order.order.id,
          match.id,
          "external_order_id",
        );
      }
    }

    const windowStart = new Date(
      Date.now() - DUPLICATE_DETECTION_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const candidates = await this.store.findRecentOrdersForCustomer(
      tenantId,
      order.order.customerId,
      order.order.id,
      windowStart,
    );
    const orderSkus = order.lines.map((line) => line.sku);
    for (const candidate of candidates) {
      if (sameSkuSet(candidate.skus, orderSkus)) {
        return this.flag(tenantId, order.order.id, candidate.id, "sku_set");
      }
    }

    return null;
  }

  private async flag(
    tenantId: string,
    orderId: string,
    duplicateOfOrderId: string,
    matchType: DuplicateFlag["matchType"],
  ): Promise<DuplicateFlag> {
    const exception = await this.exceptions.create(
      tenantId,
      orderId,
      DUPLICATE_SUSPECTED_REASON,
      defaultDueAt(this.clock.now()),
      { suspectedDuplicateOfOrderId: duplicateOfOrderId, matchType },
    );
    return { duplicateOfOrderId, exceptionId: exception.id, matchType };
  }

  /**
   * `accept` keeps both orders and just closes the exception. `merge`
   * additionally cancels the flagged (newer) order — it never silently
   * combines line items or deletes anything; a human chose this explicitly.
   */
  async review(
    tenantId: string,
    exceptionId: string,
    action: "accept" | "merge",
  ): Promise<DuplicateReviewResult> {
    const exception = await this.exceptions.getById(tenantId, exceptionId);
    if (!exception) {
      throw new ExceptionNotFoundError();
    }
    if (exception.reasonCode !== DUPLICATE_SUSPECTED_REASON) {
      throw new NotADuplicateExceptionError();
    }
    if (exception.status !== "open") {
      throw new ExceptionAlreadyResolvedError();
    }

    let cancelledOrderId: string | null = null;
    if (action === "merge") {
      const order = await this.store.getById(tenantId, exception.orderId);
      if (order) {
        transition(order.order.status as OrderState, "cancelled");
        await this.store.updateStatus(tenantId, exception.orderId, "cancelled");
        cancelledOrderId = exception.orderId;
      }
    }

    const resolved = await this.exceptions.resolve(
      tenantId,
      exceptionId,
      `duplicate_review:${action}`,
    );
    if (!resolved) {
      throw new ExceptionAlreadyResolvedError();
    }

    return { action, cancelledOrderId };
  }
}
