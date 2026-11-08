import { useState, useEffect, useCallback } from "react";

export interface InventoryItem {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  available: number;
  reorderLevel: number;
  lastRestocked: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryFilters {
  warehouseId?: string;
  productId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export function useInventory(filters?: InventoryFilters) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 0,
    pageSize: 20,
    hasMore: false,
    total: 0,
  });

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.warehouseId) params.append("warehouseId", filters.warehouseId);
      if (filters?.productId) params.append("productId", filters.productId);
      if (filters?.page !== undefined) params.append("page", filters.page.toString());
      if (filters?.pageSize) params.append("pageSize", filters.pageSize.toString());
      if (filters?.sortBy) params.append("sortBy", filters.sortBy);
      if (filters?.sortOrder) params.append("sortOrder", filters.sortOrder);

      const response = await fetch(`/api/inventory?${params}`);
      if (!response.ok) throw new Error("Failed to fetch inventory");

      const data = await response.json();
      setItems(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const adjustStock = useCallback(
    async (
      inventoryId: string,
      adjustmentType: "add" | "remove" | "adjust",
      quantity: number,
      reason: string,
      notes?: string
    ) => {
      try {
        const response = await fetch("/api/inventory/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventoryId,
            adjustmentType,
            quantity,
            reason,
            notes,
          }),
        });

        if (!response.ok) throw new Error("Failed to adjust inventory");

        const data = await response.json();
        await fetchInventory(); // Refresh data
        return data.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      }
    },
    [fetchInventory]
  );

  const transferStock = useCallback(
    async (
      fromInventoryId: string,
      toInventoryId: string,
      quantity: number,
      reason: string,
      notes?: string
    ) => {
      try {
        const response = await fetch("/api/inventory/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromInventoryId,
            toInventoryId,
            quantity,
            reason,
            notes,
          }),
        });

        if (!response.ok) throw new Error("Failed to transfer inventory");

        const data = await response.json();
        await fetchInventory(); // Refresh data
        return data.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      }
    },
    [fetchInventory]
  );

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return {
    items,
    loading,
    error,
    pagination,
    fetchInventory,
    adjustStock,
    transferStock,
  };
}
