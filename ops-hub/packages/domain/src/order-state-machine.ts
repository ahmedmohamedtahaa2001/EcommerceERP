/**
 * Order lifecycle states and the transition table between them.
 *
 * `ecommerce-ops-system-architecture.md` (referenced by the roadmap as the
 * source for this) does not exist anywhere in the repo. This table is
 * reconstructed from the states and transitions already named elsewhere in
 * ROADMAP.md (`validated → confirmed → allocated`, `on_hold` with an
 * exception, `label_created` separate from `shipped`/`carrier_accepted`,
 * "cancel before dispatch"). Revisit if the real architecture doc turns up.
 */
export const ORDER_STATES = [
  "pending",
  "validated",
  "on_hold",
  "confirmed",
  "allocated",
  "label_created",
  "shipped",
  "out_for_delivery",
  "delivered",
  "returned_to_sender",
  "cancelled",
  "closed",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export class InvalidTransitionError extends Error {
  constructor(from: OrderState, to: OrderState) {
    super(`Invalid order transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

const TRANSITIONS: Readonly<Record<OrderState, readonly OrderState[]>> = {
  pending: ["validated", "on_hold", "cancelled"],
  validated: ["confirmed", "on_hold", "cancelled"],
  on_hold: ["validated", "cancelled"],
  confirmed: ["allocated", "cancelled"],
  allocated: ["label_created", "cancelled"],
  // "cancel before dispatch" (P3-S11-T05) means cancellation is only valid
  // up through `allocated`; once a label exists, the only ways out are the
  // normal shipping path or a carrier return.
  label_created: ["shipped"],
  shipped: ["out_for_delivery", "returned_to_sender"],
  out_for_delivery: ["delivered", "returned_to_sender"],
  delivered: ["closed"],
  returned_to_sender: ["closed"],
  cancelled: [],
  closed: [],
};

/** Returns `to` if the transition is allowed; throws `InvalidTransitionError` otherwise. */
export function transition(from: OrderState, to: OrderState): OrderState {
  if (!TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
  return to;
}

/** The statuses an order may move to next, in the order they are defined. */
export function nextStates(from: OrderState): readonly OrderState[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: OrderState, to: OrderState): boolean {
  return TRANSITIONS[from].includes(to);
}
