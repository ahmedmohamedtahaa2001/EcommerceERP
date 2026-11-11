import {
  ADJUSTMENT_REASONS,
  type AdjustmentReason,
} from "./adjustment-reasons";
import { StockValidationError } from "./errors";
import type { StockService } from "./service";
import type { MovementActor, StockBucket, StockMovementRecord } from "./types";

export interface AdjustmentRequest {
  variantId: string;
  locationId: string;
  bucket: StockBucket;
  delta: number;
  reason: string;
  reference?: string | null;
}

/**
 * A stock movement whose reason is restricted to a fixed enum
 * (`ADJUSTMENT_REASONS`), rather than the free-text reason the raw ledger
 * endpoint (`POST /v1/inventory/movements`) accepts.
 */
export class AdjustmentService {
  constructor(private readonly stock: StockService) {}

  async adjust(
    request: AdjustmentRequest,
    tenantId: string,
    actor: MovementActor | null,
  ): Promise<StockMovementRecord> {
    if (
      typeof request.reason !== "string" ||
      !(ADJUSTMENT_REASONS as readonly string[]).includes(request.reason)
    ) {
      throw new StockValidationError(
        `reason is required and must be one of: ${ADJUSTMENT_REASONS.join(", ")}.`,
      );
    }

    const { movement } = await this.stock.recordMovement(
      {
        variantId: request.variantId,
        locationId: request.locationId,
        bucket: request.bucket,
        delta: request.delta,
        reason: request.reason as AdjustmentReason,
        ...(request.reference !== undefined
          ? { reference: request.reference }
          : {}),
      },
      tenantId,
      actor,
    );
    return movement;
  }
}
