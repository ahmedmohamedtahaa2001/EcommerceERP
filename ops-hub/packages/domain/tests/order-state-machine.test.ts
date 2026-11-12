import { describe, expect, it } from "vitest";

import {
  ORDER_STATES,
  InvalidTransitionError,
  transition,
  type OrderState,
} from "../src/order-state-machine";

const ALLOWED: [OrderState, OrderState][] = [
  ["pending", "validated"],
  ["pending", "on_hold"],
  ["pending", "cancelled"],
  ["validated", "confirmed"],
  ["validated", "on_hold"],
  ["validated", "cancelled"],
  ["on_hold", "validated"],
  ["on_hold", "cancelled"],
  ["confirmed", "allocated"],
  ["confirmed", "cancelled"],
  ["allocated", "label_created"],
  ["allocated", "cancelled"],
  ["label_created", "shipped"],
  ["shipped", "out_for_delivery"],
  ["shipped", "returned_to_sender"],
  ["out_for_delivery", "delivered"],
  ["out_for_delivery", "returned_to_sender"],
  ["delivered", "closed"],
  ["returned_to_sender", "closed"],
];

describe("order state machine", () => {
  it.each(ALLOWED)("allows %s -> %s", (from, to) => {
    expect(transition(from, to)).toBe(to);
  });

  it("rejects label_created -> delivered directly (must pass through shipped and out_for_delivery)", () => {
    expect(() => transition("label_created", "delivered")).toThrow(
      InvalidTransitionError,
    );
  });

  it("rejects every (from, to) pair that isn't explicitly allowed", () => {
    const allowedSet = new Set(ALLOWED.map(([from, to]) => `${from}->${to}`));
    const forbidden: [OrderState, OrderState][] = [];

    for (const from of ORDER_STATES) {
      for (const to of ORDER_STATES) {
        if (!allowedSet.has(`${from}->${to}`)) {
          forbidden.push([from, to]);
        }
      }
    }

    // Comfortably over the "at least 20 forbidden" bar from the AC.
    expect(forbidden.length).toBeGreaterThanOrEqual(20);

    for (const [from, to] of forbidden) {
      expect(() => transition(from, to)).toThrow(InvalidTransitionError);
    }
  });

  it("never allows a transition out of a terminal state", () => {
    for (const terminal of ["cancelled", "closed"] as const) {
      for (const to of ORDER_STATES) {
        expect(() => transition(terminal, to)).toThrow(InvalidTransitionError);
      }
    }
  });

  it("rejects a same-state no-op transition", () => {
    for (const state of ORDER_STATES) {
      expect(() => transition(state, state)).toThrow(InvalidTransitionError);
    }
  });

  it("InvalidTransitionError names both states", () => {
    expect(() => transition("pending", "delivered")).toThrow(
      /pending.*delivered/,
    );
  });
});
