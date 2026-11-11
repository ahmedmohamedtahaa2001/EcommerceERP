export interface LocationAvailability {
  locationId: string;
  onHand: number;
  reserved: number;
  quarantined: number;
  damaged: number;
  /** `on_hand - reserved - quarantined - damaged`, clamped per tenant policy. */
  availableToPromise: number;
}

export interface TotalAvailability {
  onHand: number;
  reserved: number;
  quarantined: number;
  damaged: number;
  availableToPromise: number;
}

export interface Availability {
  sku: string;
  variantId: string;
  locations: LocationAvailability[];
  total: TotalAvailability;
}

export interface AvailabilityVariantLookup {
  getBySku(tenantId: string, sku: string): Promise<{ id: string } | null>;
}

export interface AvailabilityBalanceReader {
  listBalances(
    tenantId: string,
    filter: { variantId?: string; locationId?: string },
  ): Promise<
    ReadonlyArray<{ locationId: string; bucket: string; quantity: number }>
  >;
}

export interface TenantStockPolicyReader {
  allowsNegativeStock(tenantId: string): Promise<boolean>;
}

export interface AvailabilityServiceDeps {
  variants: AvailabilityVariantLookup;
  balances: AvailabilityBalanceReader;
  policy: TenantStockPolicyReader;
}
