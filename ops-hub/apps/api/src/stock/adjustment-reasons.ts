/**
 * The one source of truth for adjustment reason codes: both the validation
 * in `AdjustmentService` and `GET /v1/meta/enums` read from this array, so
 * they can never drift apart.
 */
export const ADJUSTMENT_REASONS = [
  "COUNT_VARIANCE",
  "DAMAGE",
  "LOSS",
  "FOUND",
  "CORRECTION",
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];
