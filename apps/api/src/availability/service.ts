import { InvalidStockInputError } from "../stock/errors";
import type { StockStore } from "../stock/types";
import type { CatalogStore } from "../catalog/types";
import type { AvailabilityReport, LocationAvailability } from "./types";

export interface AvailabilityServiceDeps {
  stock: StockStore;
  catalog: CatalogStore;
  allowNegativeByDefault?: boolean;
}

export class AvailabilityService {
  constructor(private readonly deps: AvailabilityServiceDeps) {}

  async getAvailability(
    tenantId: string,
    sku: string,
    locationId: string | undefined,
    allowNegative: boolean,
  ): Promise<AvailabilityReport> {
    const variant = await this.deps.catalog.getVariantBySku(tenantId, sku);
    if (!variant) {
      throw new InvalidStockInputError(`unknown sku: ${sku}`);
    }

    const locations = new Set(await this.deps.stock.listLocationsWithBalance(tenantId, variant.id));
    if (locationId) locations.add(locationId);

    const byLocation: LocationAvailability[] = [];
    let totalAvailable = 0;

    for (const loc of locations) {
      const balances = await this.deps.stock.getBalances(tenantId, variant.id, loc);
      const onHand = balances.on_hand ?? 0;
      const reserved = balances.reserved ?? 0;
      const quarantined = balances.quarantined ?? 0;
      const damaged = balances.damaged ?? 0;
      const inTransit = balances.in_transit ?? 0;
      let available = onHand - reserved - quarantined - damaged;
      if (!allowNegative && available < 0) available = 0;
      byLocation.push({ locationId: loc, onHand, reserved, quarantined, damaged, inTransit, available });
      totalAvailable += available;
    }

    const requestedAvailable = locationId
      ? (byLocation.find((l) => l.locationId === locationId)?.available ?? 0)
      : totalAvailable;

    return {
      sku,
      variantId: variant.id,
      locationId: locationId ?? null,
      available: requestedAvailable,
      totalAvailable,
      byLocation,
    };
  }
}
