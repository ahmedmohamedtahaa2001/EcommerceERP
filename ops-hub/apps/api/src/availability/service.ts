import { AvailabilityValidationError, SkuNotFoundError } from "./errors";
import type {
  Availability,
  AvailabilityServiceDeps,
  LocationAvailability,
} from "./types";

function emptyBuckets() {
  return { onHand: 0, reserved: 0, quarantined: 0, damaged: 0 };
}

function computeAtp(
  buckets: ReturnType<typeof emptyBuckets>,
  allowNegative: boolean,
): number {
  const raw =
    buckets.onHand - buckets.reserved - buckets.quarantined - buckets.damaged;
  return allowNegative ? raw : Math.max(0, raw);
}

export class AvailabilityService {
  constructor(private readonly deps: AvailabilityServiceDeps) {}

  async getAvailability(
    tenantId: string,
    sku: string,
    locationId?: string,
  ): Promise<Availability> {
    if (sku.trim() === "") {
      throw new AvailabilityValidationError("sku is required.");
    }

    const variant = await this.deps.variants.getBySku(tenantId, sku);
    if (!variant) {
      throw new SkuNotFoundError(sku);
    }

    const allowNegative = await this.deps.policy.allowsNegativeStock(tenantId);
    const rows = await this.deps.balances.listBalances(tenantId, {
      variantId: variant.id,
      ...(locationId !== undefined ? { locationId } : {}),
    });

    const byLocation = new Map<string, ReturnType<typeof emptyBuckets>>();
    for (const row of rows) {
      const buckets = byLocation.get(row.locationId) ?? emptyBuckets();
      if (row.bucket === "on_hand") buckets.onHand += row.quantity;
      else if (row.bucket === "reserved") buckets.reserved += row.quantity;
      else if (row.bucket === "quarantined")
        buckets.quarantined += row.quantity;
      else if (row.bucket === "damaged") buckets.damaged += row.quantity;
      // in_transit is tracked but excluded from the ATP formula by design.
      byLocation.set(row.locationId, buckets);
    }

    const locations: LocationAvailability[] = [...byLocation.entries()].map(
      ([locId, buckets]) => ({
        locationId: locId,
        ...buckets,
        availableToPromise: computeAtp(buckets, allowNegative),
      }),
    );
    locations.sort((a, b) => a.locationId.localeCompare(b.locationId));

    const totalBuckets = emptyBuckets();
    for (const buckets of byLocation.values()) {
      totalBuckets.onHand += buckets.onHand;
      totalBuckets.reserved += buckets.reserved;
      totalBuckets.quarantined += buckets.quarantined;
      totalBuckets.damaged += buckets.damaged;
    }

    return {
      sku,
      variantId: variant.id,
      locations,
      total: {
        ...totalBuckets,
        availableToPromise: computeAtp(totalBuckets, allowNegative),
      },
    };
  }
}
