import { describe, expect, it } from "vitest";

import { AvailabilityService } from "../src/availability/service";
import { SkuNotFoundError } from "../src/availability/errors";

const TENANT = "tenant-1";
const VARIANT_ID = "variant-1";
const SKU = "SKU-1";

interface Row {
  locationId: string;
  bucket: string;
  quantity: number;
}

function buildService(rows: Row[], allowNegative = false) {
  return new AvailabilityService({
    variants: {
      async getBySku(tenantId, sku) {
        return tenantId === TENANT && sku === SKU ? { id: VARIANT_ID } : null;
      },
    },
    balances: {
      async listBalances(tenantId, filter) {
        return rows.filter(
          (row) =>
            tenantId === TENANT &&
            (filter.locationId === undefined ||
              row.locationId === filter.locationId),
        );
      },
    },
    policy: {
      async allowsNegativeStock() {
        return allowNegative;
      },
    },
  });
}

describe("AvailabilityService", () => {
  it("throws for an unknown sku", async () => {
    const service = buildService([]);
    await expect(service.getAvailability(TENANT, "NOPE")).rejects.toThrow(
      SkuNotFoundError,
    );
  });

  it("returns zeroed availability when there are no balances at all", async () => {
    const service = buildService([]);
    const result = await service.getAvailability(TENANT, SKU);

    expect(result.locations).toEqual([]);
    expect(result.total).toEqual({
      onHand: 0,
      reserved: 0,
      quarantined: 0,
      damaged: 0,
      availableToPromise: 0,
    });
  });

  it("computes ATP = on_hand - reserved - quarantined - damaged for a single bucket", async () => {
    const service = buildService([
      { locationId: "L1", bucket: "on_hand", quantity: 10 },
    ]);
    const result = await service.getAvailability(TENANT, SKU);

    expect(result.locations).toEqual([
      {
        locationId: "L1",
        onHand: 10,
        reserved: 0,
        quarantined: 0,
        damaged: 0,
        availableToPromise: 10,
      },
    ]);
  });

  it("subtracts reserved from on_hand", async () => {
    const service = buildService([
      { locationId: "L1", bucket: "on_hand", quantity: 10 },
      { locationId: "L1", bucket: "reserved", quantity: 4 },
    ]);
    const result = await service.getAvailability(TENANT, SKU);
    expect(result.locations[0]?.availableToPromise).toBe(6);
  });

  it("subtracts quarantined from on_hand", async () => {
    const service = buildService([
      { locationId: "L1", bucket: "on_hand", quantity: 10 },
      { locationId: "L1", bucket: "quarantined", quantity: 3 },
    ]);
    const result = await service.getAvailability(TENANT, SKU);
    expect(result.locations[0]?.availableToPromise).toBe(7);
  });

  it("subtracts damaged from on_hand", async () => {
    const service = buildService([
      { locationId: "L1", bucket: "on_hand", quantity: 10 },
      { locationId: "L1", bucket: "damaged", quantity: 2 },
    ]);
    const result = await service.getAvailability(TENANT, SKU);
    expect(result.locations[0]?.availableToPromise).toBe(8);
  });

  it("ignores in_transit entirely in the ATP formula", async () => {
    const service = buildService([
      { locationId: "L1", bucket: "on_hand", quantity: 10 },
      { locationId: "L1", bucket: "in_transit", quantity: 1000 },
    ]);
    const result = await service.getAvailability(TENANT, SKU);
    expect(result.locations[0]?.availableToPromise).toBe(10);
  });

  it("combines all four ATP buckets at once", async () => {
    const service = buildService([
      { locationId: "L1", bucket: "on_hand", quantity: 20 },
      { locationId: "L1", bucket: "reserved", quantity: 5 },
      { locationId: "L1", bucket: "quarantined", quantity: 3 },
      { locationId: "L1", bucket: "damaged", quantity: 2 },
    ]);
    const result = await service.getAvailability(TENANT, SKU);
    expect(result.locations[0]?.availableToPromise).toBe(10);
  });

  it("clamps a negative ATP to zero by default", async () => {
    const service = buildService([
      { locationId: "L1", bucket: "on_hand", quantity: 5 },
      { locationId: "L1", bucket: "reserved", quantity: 20 },
    ]);
    const result = await service.getAvailability(TENANT, SKU);
    expect(result.locations[0]?.availableToPromise).toBe(0);
  });

  it("returns a true negative ATP when the tenant's policy allows it", async () => {
    const service = buildService(
      [
        { locationId: "L1", bucket: "on_hand", quantity: 5 },
        { locationId: "L1", bucket: "reserved", quantity: 20 },
      ],
      true,
    );
    const result = await service.getAvailability(TENANT, SKU);
    expect(result.locations[0]?.availableToPromise).toBe(-15);
  });

  it("sums across locations into a total, clamped independently of each location", async () => {
    const service = buildService([
      { locationId: "L1", bucket: "on_hand", quantity: 5 },
      { locationId: "L1", bucket: "reserved", quantity: 20 }, // L1 clamps to 0
      { locationId: "L2", bucket: "on_hand", quantity: 8 },
    ]);
    const result = await service.getAvailability(TENANT, SKU);

    const l1 = result.locations.find((l) => l.locationId === "L1");
    const l2 = result.locations.find((l) => l.locationId === "L2");
    expect(l1?.availableToPromise).toBe(0);
    expect(l2?.availableToPromise).toBe(8);
    // Total is computed from raw summed buckets (5 - 20 + 8 = -7), then
    // clamped once at the total level — not the sum of the per-location
    // clamped values (which would be 0 + 8 = 8).
    expect(result.total.availableToPromise).toBe(0);
  });

  it("filters to a single location when one is requested", async () => {
    const service = buildService([
      { locationId: "L1", bucket: "on_hand", quantity: 5 },
      { locationId: "L2", bucket: "on_hand", quantity: 8 },
    ]);
    const result = await service.getAvailability(TENANT, SKU, "L1");

    expect(result.locations).toHaveLength(1);
    expect(result.locations[0]?.locationId).toBe("L1");
  });
});
