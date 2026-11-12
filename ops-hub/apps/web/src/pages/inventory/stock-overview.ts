import type { StockBalance } from "../../lib/api/inventory";

export interface StockOverviewRow {
  variantId: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  onHand: number;
  reserved: number;
  available: number;
}

/** One row per item: balances summed across the chosen locations, lowest availability first. */
export function summarizeBalances(
  balances: readonly StockBalance[],
  locationId: string,
): StockOverviewRow[] {
  const rows = new Map<string, StockOverviewRow>();
  for (const balance of balances) {
    if (locationId !== "" && balance.locationId !== locationId) continue;
    let row = rows.get(balance.variantId);
    if (row === undefined) {
      row = {
        variantId: balance.variantId,
        sku: balance.sku ?? balance.variantId,
        nameAr: balance.productNameAr ?? "",
        nameEn: balance.productNameEn ?? "",
        onHand: 0,
        reserved: 0,
        available: 0,
      };
      rows.set(balance.variantId, row);
    }
    if (balance.bucket === "on_hand") row.onHand += balance.quantity;
    if (balance.bucket === "reserved") row.reserved += balance.quantity;
  }
  for (const row of rows.values()) row.available = row.onHand - row.reserved;
  return [...rows.values()].sort(
    (a, b) => a.available - b.available || a.sku.localeCompare(b.sku),
  );
}
