import { randomUUID } from "node:crypto";

import {
  InsufficientStockError,
  ReservationAlreadyClosedError,
  ReservationNotFoundError,
  ReservationValidationError,
} from "./reservation-errors";
import type {
  CreateReservationRequest,
  ReservationServiceDeps,
  StockReservationRecord,
} from "./reservation-types";

const MAX_TTL_SECONDS = 24 * 60 * 60;

function lockKey(
  tenantId: string,
  variantId: string,
  locationId: string,
): string {
  return `stock-lock:${tenantId}:${variantId}:${locationId}`;
}

/**
 * Short-lived holds against available stock. `withLock` serializes
 * concurrent allocation attempts for the same variant+location so two
 * requests racing for the last unit can never both succeed.
 */
export class ReservationService {
  constructor(private readonly deps: ReservationServiceDeps) {}

  async reserve(
    request: CreateReservationRequest,
    tenantId: string,
    actor: { type: "user" | "api_key"; id: string } | null,
  ): Promise<StockReservationRecord> {
    if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
      throw new ReservationValidationError(
        "quantity must be a positive integer.",
      );
    }
    if (
      !Number.isInteger(request.ttlSeconds) ||
      request.ttlSeconds <= 0 ||
      request.ttlSeconds > MAX_TTL_SECONDS
    ) {
      throw new ReservationValidationError(
        `ttlSeconds must be a positive integer up to ${MAX_TTL_SECONDS}.`,
      );
    }

    return this.deps.lock.withLock(
      lockKey(tenantId, request.variantId, request.locationId),
      async () => {
        const buckets = await this.deps.balances.getBucketQuantities(
          tenantId,
          request.variantId,
          request.locationId,
        );
        const atp =
          buckets.onHand -
          buckets.reserved -
          buckets.quarantined -
          buckets.damaged;
        const available = Math.max(0, atp);
        if (request.quantity > available) {
          throw new InsufficientStockError(available, request.quantity);
        }

        const now = this.deps.clock.now();
        const record: StockReservationRecord = {
          id: randomUUID(),
          tenantId,
          variantId: request.variantId,
          locationId: request.locationId,
          quantity: request.quantity,
          status: "active",
          expiresAt: new Date(now.getTime() + request.ttlSeconds * 1000),
          createdAt: now,
          releasedAt: null,
        };

        await this.deps.store.create(record);
        await this.deps.movements.recordMovement(
          {
            variantId: record.variantId,
            locationId: record.locationId,
            bucket: "reserved",
            delta: record.quantity,
            reason: "RESERVATION_CREATED",
            reference: record.id,
          },
          tenantId,
          actor,
        );

        return record;
      },
    );
  }

  async release(
    tenantId: string,
    id: string,
    actor: { type: "user" | "api_key"; id: string } | null,
  ): Promise<StockReservationRecord> {
    return this.close(tenantId, id, "released", "RESERVATION_RELEASED", actor);
  }

  /**
   * Releases every active reservation whose `expiresAt` has passed. Not a
   * running background worker itself — call this from a scheduled job (or a
   * request path) once a real job runner exists.
   */
  async expireDue(
    tenantId: string,
    now: Date,
  ): Promise<{ expiredCount: number }> {
    const due = await this.deps.store.listExpiredActive(tenantId, now);
    let expiredCount = 0;
    for (const reservation of due) {
      try {
        await this.close(
          tenantId,
          reservation.id,
          "expired",
          "RESERVATION_EXPIRED",
          null,
        );
        expiredCount += 1;
      } catch {
        // Already closed by a concurrent release/expire; skip.
      }
    }
    return { expiredCount };
  }

  private async close(
    tenantId: string,
    id: string,
    status: "released" | "expired",
    reason: string,
    actor: { type: "user" | "api_key"; id: string } | null,
  ): Promise<StockReservationRecord> {
    const existing = await this.deps.store.getById(tenantId, id);
    if (!existing) {
      throw new ReservationNotFoundError();
    }
    if (existing.status !== "active") {
      throw new ReservationAlreadyClosedError();
    }

    const releasedAt = this.deps.clock.now();
    const closed = await this.deps.store.closeActive(
      tenantId,
      id,
      status,
      releasedAt,
    );
    if (!closed) {
      throw new ReservationAlreadyClosedError();
    }

    await this.deps.movements.recordMovement(
      {
        variantId: existing.variantId,
        locationId: existing.locationId,
        bucket: "reserved",
        delta: -existing.quantity,
        reason,
        reference: existing.id,
      },
      tenantId,
      actor,
    );

    return { ...existing, status, releasedAt };
  }
}
