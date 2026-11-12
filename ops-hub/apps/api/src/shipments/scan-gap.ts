import type { ShipmentStore } from "./types";

export interface ScanGapResult {
  shipmentId: string;
  tenantId: string;
  hoursSinceLastEvent: number;
}

/**
 * Flags shipments whose most recent event is older than `thresholdHours`.
 * Returns the list of stalled shipments; caller creates exceptions.
 */
export async function findStalledShipments(
  store: ShipmentStore & {
    listAllActive(
      tenantId: string,
    ): Promise<{ id: string; lastEventAt: Date | null }[]>;
  },
  tenantId: string,
  thresholdHours: number,
  now: Date = new Date(),
): Promise<ScanGapResult[]> {
  const active = await store.listAllActive(tenantId);
  const result: ScanGapResult[] = [];
  for (const s of active) {
    if (!s.lastEventAt) continue;
    const hours = (now.getTime() - s.lastEventAt.getTime()) / (1000 * 60 * 60);
    if (hours > thresholdHours) {
      result.push({ shipmentId: s.id, tenantId, hoursSinceLastEvent: hours });
    }
  }
  return result;
}
