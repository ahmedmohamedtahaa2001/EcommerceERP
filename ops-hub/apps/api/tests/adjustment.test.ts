import { describe, expect, it } from "vitest";

import { ADJUSTMENT_REASONS } from "../src/stock/adjustment-reasons";
import { AdjustmentService } from "../src/stock/adjustment-service";
import { StockValidationError } from "../src/stock/errors";
import { StockService } from "../src/stock/service";
import type {
  StockBalanceRecord,
  StockMovementRecord,
  StockStore,
} from "../src/stock/types";

const TENANT = "tenant-1";

function fakeStore(): StockStore {
  return {
    transfer() {
      throw new Error("transfer not used in this test");
    },
    async recordMovement(record) {
      const movement: StockMovementRecord = record;
      const balance: StockBalanceRecord = {
        id: "balance-1",
        tenantId: record.tenantId,
        variantId: record.variantId,
        locationId: record.locationId!,
        bucket: record.bucket,
        quantity: record.delta,
        updatedAt: record.createdAt,
      };
      return { movement, balance };
    },
    async listMovements() {
      return [];
    },
    async listBalances() {
      return [];
    },
  };
}

function buildService(): AdjustmentService {
  const stock = new StockService({
    store: fakeStore(),
    clock: { now: () => new Date() },
  });
  return new AdjustmentService(stock);
}

describe("AdjustmentService", () => {
  it("rejects a missing reason with 422 semantics", async () => {
    const service = buildService();
    const adjustment = service.adjust(
      {
        variantId: "v1",
        locationId: "l1",
        bucket: "on_hand",
        delta: 5,
        reason: "",
      },
      TENANT,
      null,
    );
    await expect(adjustment).rejects.toThrow(StockValidationError);
    await expect(adjustment).rejects.toMatchObject({ statusCode: 422 });
  });

  it("rejects a reason that isn't in the fixed enum", async () => {
    const service = buildService();
    await expect(
      service.adjust(
        {
          variantId: "v1",
          locationId: "l1",
          bucket: "on_hand",
          delta: 5,
          reason: "WHATEVER",
        },
        TENANT,
        null,
      ),
    ).rejects.toThrow(StockValidationError);
  });

  it("accepts every reason in ADJUSTMENT_REASONS", async () => {
    const service = buildService();
    for (const reason of ADJUSTMENT_REASONS) {
      const movement = await service.adjust(
        {
          variantId: "v1",
          locationId: "l1",
          bucket: "on_hand",
          delta: 1,
          reason,
        },
        TENANT,
        null,
      );
      expect(movement.reason).toBe(reason);
    }
  });
});
