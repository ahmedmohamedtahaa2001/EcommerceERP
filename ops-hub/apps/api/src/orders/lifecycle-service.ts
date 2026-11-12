import { canTransition, ORDER_STATES, type OrderState } from "@ops-hub/domain";

import { OrderError, OrderNotFoundError, OrderValidationError } from "./errors";
import type { OrderStore } from "./types";

export class InvalidOrderTransitionError extends OrderError {
  constructor(from: string, to: string) {
    super(
      "invalid-transition",
      `An order cannot move from ${from} to ${to}.`,
      409,
    );
  }
}

type Actor = { type: "user" | "api_key"; id: string } | null;

/** Releases the stock an order holds; implemented by the reservation service. */
export interface OrderStockReleaser {
  releaseForOrder(
    tenantId: string,
    orderId: string,
    actor: Actor,
  ): Promise<number>;
  fulfillForOrder(
    tenantId: string,
    orderId: string,
    actor: Actor,
  ): Promise<number>;
}

/**
 * Moves an order through the state machine. Validation has its own path
 * (it reserves stock); everything else goes through here. Cancelling gives the
 * order's reserved stock back.
 */
export class OrderLifecycleService {
  constructor(
    private readonly deps: { store: OrderStore; stock: OrderStockReleaser },
  ) {}

  async transition(
    tenantId: string,
    orderId: string,
    to: unknown,
    actor: Actor,
    note?: string,
  ): Promise<{
    from: string;
    to: OrderState;
    releasedReservations: number;
    shippedReservations: number;
  }> {
    if (
      typeof to !== "string" ||
      !(ORDER_STATES as readonly string[]).includes(to)
    ) {
      throw new OrderValidationError(
        `to must be one of: ${ORDER_STATES.join(", ")}.`,
      );
    }
    if (to === "validated") {
      throw new OrderValidationError(
        "Use the validate action, which checks stock and reserves it.",
      );
    }
    const order = await this.deps.store.getById(tenantId, orderId);
    if (!order) throw new OrderNotFoundError();
    const from = order.order.status as OrderState;
    if (!canTransition(from, to as OrderState)) {
      throw new InvalidOrderTransitionError(from, to);
    }

    await this.deps.store.updateStatus(tenantId, orderId, to, actor, note);
    const releasedReservations =
      to === "cancelled"
        ? await this.deps.stock.releaseForOrder(tenantId, orderId, actor)
        : 0;
    const shippedReservations =
      to === "shipped"
        ? await this.deps.stock.fulfillForOrder(tenantId, orderId, actor)
        : 0;
    return {
      from,
      to: to as OrderState,
      releasedReservations,
      shippedReservations,
    };
  }
}
