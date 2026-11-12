import { randomUUID } from "node:crypto";

import { StockReferenceNotFoundError, StockValidationError } from "./errors";
import {
  STOCK_BUCKETS,
  type CreateMovementRequest,
  type MovementActor,
  type StockBalanceRecord,
  type StockMovementRecord,
  type StockServiceDeps,
  type StockTransferRequest,
  type StockTransferResult,
} from "./types";

const MAX_REASON_LENGTH = 200;
const MAX_REFERENCE_LENGTH = 200;

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23503"
  );
}

/**
 * The stock ledger primitive: every balance change is recorded here as a
 * movement, and `stock_balances` is only ever updated as a side effect of
 * recording one. No other code path writes to `stock_balances`.
 */
export class StockService {
  constructor(private readonly deps: StockServiceDeps) {}

  async recordMovement(
    request: CreateMovementRequest,
    tenantId: string,
    actor: MovementActor | null,
  ): Promise<{ movement: StockMovementRecord; balance: StockBalanceRecord }> {
    if (!(STOCK_BUCKETS as readonly string[]).includes(request.bucket)) {
      throw new StockValidationError(
        `bucket must be one of: ${STOCK_BUCKETS.join(", ")}.`,
      );
    }
    if (!Number.isInteger(request.delta) || request.delta === 0) {
      throw new StockValidationError("delta must be a non-zero integer.");
    }
    const reason = request.reason?.trim() ?? "";
    if (reason === "" || reason.length > MAX_REASON_LENGTH) {
      throw new StockValidationError(
        `reason is required and must be at most ${MAX_REASON_LENGTH} characters.`,
      );
    }
    if (
      request.reference !== undefined &&
      request.reference !== null &&
      request.reference.length > MAX_REFERENCE_LENGTH
    ) {
      throw new StockValidationError(
        `reference must be at most ${MAX_REFERENCE_LENGTH} characters.`,
      );
    }

    const record: StockMovementRecord = {
      id: randomUUID(),
      tenantId,
      variantId: request.variantId,
      locationId: request.locationId,
      bucket: request.bucket,
      delta: request.delta,
      reason,
      reference: request.reference ?? null,
      actorType: actor?.type ?? null,
      actorId: actor?.id ?? null,
      createdAt: this.deps.clock.now(),
    };

    try {
      return await this.deps.store.recordMovement(record);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new StockReferenceNotFoundError();
      }
      throw error;
    }
  }

  async transfer(
    request: StockTransferRequest,
    tenantId: string,
    actor: MovementActor | null,
  ): Promise<StockTransferResult> {
    if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
      throw new StockValidationError("quantity must be a positive integer.");
    }
    if (request.fromLocationId === request.toLocationId) {
      throw new StockValidationError(
        "fromLocationId and toLocationId must differ.",
      );
    }
    const reason = request.reason?.trim() ?? "";
    if (reason === "" || reason.length > MAX_REASON_LENGTH) {
      throw new StockValidationError(
        `reason is required and must be at most ${MAX_REASON_LENGTH} characters.`,
      );
    }

    const allowNegative =
      (await this.deps.policy?.allowsNegativeStock(tenantId)) ?? false;
    try {
      return await this.deps.store.transfer({
        ...request,
        reason,
        tenantId,
        transferId: randomUUID(),
        actor,
        createdAt: this.deps.clock.now(),
        allowNegative,
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new StockReferenceNotFoundError();
      }
      throw error;
    }
  }

  async listMovements(
    tenantId: string,
    filter: {
      variantId?: string;
      locationId?: string;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<StockMovementRecord[]> {
    return this.deps.store.listMovements(tenantId, filter);
  }

  async listBalances(
    tenantId: string,
    filter: {
      variantId?: string;
      locationId?: string;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<StockBalanceRecord[]> {
    return this.deps.store.listBalances(tenantId, filter);
  }
}
