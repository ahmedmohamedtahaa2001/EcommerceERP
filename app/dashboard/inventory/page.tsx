"use client";

import { useState, useEffect } from "react";

interface InventoryItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity_on_hand: number;
  quantity_available: number;
  created_at: string;
}

interface BinLocationSuggestion {
  id: string;
  code: string;
  zone: string | null;
  location_type: string;
  freeCapacity: number | null;
  alreadyHoldsProduct: boolean;
}

interface BinStockRow {
  id: string;
  quantity: number;
  bin_location_id: string;
  bin_locations: {
    code: string;
    zone: string | null;
    location_type: string;
  } | null;
}

interface PutawayState {
  inventoryId: string;
  loading: boolean;
  error: string | null;
  quantityOnHand: number;
  quantityPutAway: number;
  quantityUnassigned: number;
  bins: BinStockRow[];
  suggestions: BinLocationSuggestion[];
  selectedBinId: string;
  quantity: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [putaway, setPutaway] = useState<PutawayState | null>(null);

  const fetchInventory = async () => {
    try {
      const response = await fetch("/api/inventory?page=0&pageSize=20");
      if (!response.ok) throw new Error("Failed to fetch inventory");
      const data = await response.json();
      setInventory(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openPutaway = async (inventoryId: string) => {
    setPutaway({
      inventoryId,
      loading: true,
      error: null,
      quantityOnHand: 0,
      quantityPutAway: 0,
      quantityUnassigned: 0,
      bins: [],
      suggestions: [],
      selectedBinId: "",
      quantity: "",
    });

    try {
      const response = await fetch(
        `/api/inventory/${inventoryId}/bins?suggest=true`,
      );
      if (!response.ok) throw new Error("Failed to load bin locations");
      const data = await response.json();
      const d = data.data;
      setPutaway((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              quantityOnHand: d.quantityOnHand,
              quantityPutAway: d.quantityPutAway,
              quantityUnassigned: d.quantityUnassigned,
              bins: d.bins || [],
              suggestions: d.suggestions || [],
              selectedBinId: d.suggestions?.[0]?.id || "",
              quantity:
                d.quantityUnassigned > 0 ? String(d.quantityUnassigned) : "",
            }
          : prev,
      );
    } catch (err) {
      setPutaway((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error:
                err instanceof Error
                  ? err.message
                  : "Failed to load bin locations",
            }
          : prev,
      );
    }
  };

  const submitPutaway = async () => {
    if (!putaway || !putaway.selectedBinId || !putaway.quantity) return;

    try {
      const response = await fetch(
        `/api/inventory/${putaway.inventoryId}/putaway`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            binLocationId: putaway.selectedBinId,
            quantity: Number(putaway.quantity),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to put away stock");

      await openPutaway(putaway.inventoryId);
    } catch (err) {
      setPutaway((prev) =>
        prev
          ? {
              ...prev,
              error:
                err instanceof Error ? err.message : "Failed to put away stock",
            }
          : prev,
      );
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Add Item
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">
                  Product ID
                </th>
                <th className="px-6 py-3 text-left font-semibold">
                  Warehouse ID
                </th>
                <th className="px-6 py-3 text-left font-semibold">Quantity</th>
                <th className="px-6 py-3 text-left font-semibold">Available</th>
                <th className="px-6 py-3 text-left font-semibold">Created</th>
                <th className="px-6 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No inventory items found
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">
                      {item.product_id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">
                      {item.warehouse_id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4">{item.quantity_on_hand}</td>
                    <td className="px-6 py-4">{item.quantity_available}</td>
                    <td className="px-6 py-4">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        className="text-green-600 hover:text-green-800 mr-4"
                        onClick={() => openPutaway(item.id)}
                      >
                        Putaway
                      </button>
                      <button className="text-blue-600 hover:text-blue-800 mr-4">
                        Adjust
                      </button>
                      <button className="text-red-600 hover:text-red-800">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {putaway && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Putaway</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setPutaway(null)}
              >
                ✕
              </button>
            </div>

            {putaway.loading ? (
              <div className="text-center py-6">Loading...</div>
            ) : (
              <>
                {putaway.error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
                    {putaway.error}
                  </div>
                )}

                <div className="mb-4 text-sm text-gray-600 space-y-1">
                  <div>On hand: {putaway.quantityOnHand}</div>
                  <div>Already put away: {putaway.quantityPutAway}</div>
                  <div className="font-semibold text-gray-900">
                    Unassigned (needs a bin): {putaway.quantityUnassigned}
                  </div>
                </div>

                {putaway.bins.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-sm mb-2">Current bins</h3>
                    <ul className="text-sm space-y-1">
                      {putaway.bins.map((row) => (
                        <li
                          key={row.id}
                          className="flex justify-between border-b pb-1"
                        >
                          <span>
                            {row.bin_locations?.code || row.bin_location_id}
                          </span>
                          <span>{row.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {putaway.quantityUnassigned > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Suggested bin</h3>
                    {putaway.suggestions.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No available bin locations in this warehouse. Create one
                        from the warehouse page first.
                      </p>
                    ) : (
                      <>
                        <select
                          className="w-full border rounded px-3 py-2"
                          value={putaway.selectedBinId}
                          onChange={(e) =>
                            setPutaway((prev) =>
                              prev
                                ? { ...prev, selectedBinId: e.target.value }
                                : prev,
                            )
                          }
                        >
                          {putaway.suggestions.map((bin) => (
                            <option key={bin.id} value={bin.id}>
                              {bin.code}
                              {bin.zone ? ` (${bin.zone})` : ""}
                              {bin.alreadyHoldsProduct
                                ? " — already holds this product"
                                : ""}
                              {bin.freeCapacity != null
                                ? ` — ${bin.freeCapacity} free`
                                : ""}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min={1}
                          max={putaway.quantityUnassigned}
                          className="w-full border rounded px-3 py-2"
                          value={putaway.quantity}
                          onChange={(e) =>
                            setPutaway((prev) =>
                              prev
                                ? { ...prev, quantity: e.target.value }
                                : prev,
                            )
                          }
                          placeholder="Quantity to put away"
                        />

                        <button
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full"
                          onClick={submitPutaway}
                        >
                          Confirm putaway
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
