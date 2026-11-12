import { describe, expect, it } from "vitest";

import type { StockBalance } from "../../lib/api/inventory";
import { summarizeBalances } from "./stock-overview";

function balance(
  variantId: string,
  locationId: string,
  bucket: StockBalance["bucket"],
  quantity: number,
): StockBalance {
  return {
    id: `${variantId}-${locationId}-${bucket}`,
    tenantId: "t",
    variantId,
    locationId,
    bucket,
    quantity,
    updatedAt: "",
    sku: `SKU-${variantId}`,
    productNameAr: "منتج",
    productNameEn: "Item",
  };
}

describe("summarizeBalances", () => {
  const balances = [
    balance("a", "L1", "on_hand", 10),
    balance("a", "L2", "on_hand", 5),
    balance("a", "L1", "reserved", 3),
    balance("b", "L1", "on_hand", 1),
    balance("b", "L1", "damaged", 4),
  ];

  it("sums every location and puts the scarcest item first", () => {
    expect(summarizeBalances(balances, "")).toEqual([
      expect.objectContaining({
        sku: "SKU-b",
        onHand: 1,
        reserved: 0,
        available: 1,
      }),
      expect.objectContaining({
        sku: "SKU-a",
        onHand: 15,
        reserved: 3,
        available: 12,
      }),
    ]);
  });

  it("limits to one location", () => {
    const rows = summarizeBalances(balances, "L2");
    expect(rows).toEqual([
      expect.objectContaining({ sku: "SKU-a", onHand: 5, available: 5 }),
    ]);
  });
});
