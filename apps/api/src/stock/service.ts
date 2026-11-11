import { randomUUID } from "node:crypto";

import { InvalidStockInputError } from "./errors";
import type {
  Bucket,
  RecordMovementInput,
  StockMovementRecord,
  StockServiceDeps,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BUCKET_SET = new Set<string>([
  "on_hand",
  "reserved",
  "quarantined",
  "damaged",
  "in_transit",
]);

export class StockService {
  constructor(private readonly deps: StockServiceDeps) {}

  async recordMovement(
    input: RecordMovementInput,
    tenantId: string,
    actor: { kind: "user" | "api_key" | "system"; id: string | null },
  ): Promise<StockMovementRecord> {
    if (!UUID_PATTERN.test(input.variantId)) {
      throw new InvalidStockInputError("variantId must be a UUID.");
    }
    if (!UUID_PATTERN.test(input.locationId)) {
      throw new InvalidStockInputError("locationId must be a UUID.");
    }
    if (!BUCKET_SET.has(input.bucket)) {
      throw new InvalidStockInputError(
        `bucket must be one of: ${[...BUCKET_SET].join(", ")}.`,
      );
    }
    if (!Number.isInteger(input.delta)) {
      throw new InvalidStockInputError("delta must be an integer.");
    }
    if (typeof input.reason !== "string" || input.reason.trim() === "") {
      throw new InvalidStockInputError("reason is required.");
    }
    const reason = input.reason.trim();

    const movement: StockMovementRecord = {
      id: randomUUID(),
      tenantId,
      variantId: input.variantId,
      locationId: input.locationId,
      bucket: input.bucket as Bucket,
      delta: input.delta,
      reason,
      reference: input.reference ?? null,
      actorType: actor.kind,
      actorId: actor.id,
      createdAt: this.deps.clock.now(),
    };

    await this.deps.store.applyMovement(movement);
    return movement;
  }

  async getBalance(
    tenantId: string,
    variantId: string,
    locationId: string,
    bucket: Bucket,
  ): Promise<number> {
    return this.deps.store.getBalance(tenantId, variantId, locationId, bucket);
  }

  async getBalances(
    tenantId: string,
    variantId: string,
    locationId: string,
  ): Promise<Record<Bucket, number>> {
    return this.deps.store.getBalances(tenantId, variantId, locationId);
  }

  async listMovements(
    tenantId: string,
    filters: { variantId?: string; locationId?: string } = {},
  ): Promise<StockMovementRecord[]> {
    return this.deps.store.listMovements(tenantId, filters);
  }
}
