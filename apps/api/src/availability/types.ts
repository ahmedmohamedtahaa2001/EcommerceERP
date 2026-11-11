// availability types

export interface LocationAvailability {
  locationId: string;
  onHand: number;
  reserved: number;
  quarantined: number;
  damaged: number;
  inTransit: number;
  available: number;
}

export interface AvailabilityReport {
  sku: string;
  variantId: string;
  locationId: string | null;
  available: number;
  totalAvailable: number;
  byLocation: LocationAvailability[];
}
