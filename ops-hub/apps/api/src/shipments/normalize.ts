/**
 * Tracking normalization: map raw carrier status codes to internal statuses.
 * The mapping is data (JSON per carrier), not code. An unknown raw code does
 * NOT throw — it creates an exception `UNMAPPED_CARRIER_STATUS` and leaves
 * the shipment unchanged.
 */

import type { CarrierStatus } from "@ops-hub/integrations";

export type StatusMapping = Record<string, CarrierStatus>;

export interface NormalizeResult {
  raw: string;
  status: CarrierStatus | null; // null when unmapped
  unmapped: boolean;
}

export function normalizeStatus(
  mapping: StatusMapping,
  rawCode: string,
): NormalizeResult {
  const status = mapping[rawCode];
  if (!status) {
    return { raw: rawCode, status: null, unmapped: true };
  }
  return { raw: rawCode, status, unmapped: false };
}

/** Default Bosta mapping (placeholder — verify against real docs). */
export const BOSTA_STATUS_MAP: StatusMapping = {
  "1": "label_created",
  "2": "handed_to_carrier",
  "3": "carrier_accepted",
  "4": "in_transit",
  "5": "arrived_hub",
  "6": "out_for_delivery",
  "7": "delivered",
  "8": "delivery_exception",
  "9": "returned_to_sender",
  "10": "lost_claim_required",
};
