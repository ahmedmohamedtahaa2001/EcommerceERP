import {
  ExceptionAlreadyResolvedError,
  ExceptionNotFoundError,
} from "./duplicate-errors";
import { OrderValidationError } from "./errors";
import type { ExceptionRecord, ExceptionStore } from "./types";

export interface ExceptionServiceDeps {
  store: ExceptionStore;
  clock: { now(): Date };
}

export class ExceptionService {
  constructor(private readonly deps: ExceptionServiceDeps) {}

  async list(
    tenantId: string,
    filter: { status?: string; orderId?: string },
  ): Promise<ExceptionRecord[]> {
    return this.deps.store.list(tenantId, filter);
  }

  async getById(tenantId: string, id: string): Promise<ExceptionRecord> {
    const exception = await this.deps.store.getById(tenantId, id);
    if (!exception) {
      throw new ExceptionNotFoundError();
    }
    return exception;
  }

  async assign(
    tenantId: string,
    id: string,
    ownerId: string,
  ): Promise<ExceptionRecord> {
    if (!ownerId || ownerId.trim() === "") {
      throw new OrderValidationError("ownerId is required.");
    }
    const updated = await this.deps.store.assign(tenantId, id, ownerId);
    if (!updated) {
      throw new ExceptionNotFoundError();
    }
    return updated;
  }

  async resolve(
    tenantId: string,
    id: string,
    resolution: string,
  ): Promise<ExceptionRecord> {
    if (!resolution || resolution.trim() === "") {
      throw new OrderValidationError("resolution is required.");
    }
    const resolved = await this.deps.store.resolve(tenantId, id, resolution);
    if (!resolved) {
      const exists = await this.deps.store.getById(tenantId, id);
      throw exists
        ? new ExceptionAlreadyResolvedError()
        : new ExceptionNotFoundError();
    }
    return this.getById(tenantId, id);
  }

  /**
   * The SLA sweep: claims every open, past-due, not-yet-notified exception
   * for a tenant and emits `exception.overdue` for each (via the outbox, in
   * the same transaction as claiming — see PgExceptionStore.claimOverdue).
   * A callable sweep, not a running worker, same as ReservationService's
   * expireDue — wire a scheduled call to it once a real job runner exists.
   */
  async sweepOverdue(tenantId: string): Promise<{ overdueCount: number }> {
    const claimed = await this.deps.store.claimOverdue(
      tenantId,
      this.deps.clock.now(),
    );
    return { overdueCount: claimed.length };
  }
}
