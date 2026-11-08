"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  AlertTriangle,
  TrendingDown,
  Package,
  Warehouse,
  RefreshCw,
  ArrowRightLeft,
} from "lucide-react";
import { useInventory } from "@/hooks/useInventory";

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

interface StockMovement {
  id: string;
  type: string;
  quantityChanged: number;
  reason: string;
  createdAt: string;
}

export default function InventoryDashboard() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const {
    items: inventory,
    loading,
    error,
    pagination,
    fetchInventory,
    adjustStock,
  } = useInventory({
    warehouseId: selectedWarehouse,
    page: 0,
    pageSize: 20,
  });

  // Fetch warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch("/api/warehouses");
        const data = await response.json();
        setWarehouses(data.data || []);
        if (data.data?.length > 0) {
          setSelectedWarehouse(data.data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch warehouses:", err);
      }
    };

    fetchWarehouses();
  }, []);

  // Fetch recent movements
  useEffect(() => {
    const fetchMovements = async () => {
      try {
        const params = new URLSearchParams({
          page: "0",
          pageSize: "10",
          ...(selectedWarehouse && { warehouseId: selectedWarehouse }),
        });

        const response = await fetch(`/api/inventory/movements?${params}`);
        const data = await response.json();
        setMovements(data.data || []);
      } catch (err) {
        console.error("Failed to fetch movements:", err);
      }
    };

    if (selectedWarehouse) {
      fetchMovements();
    }
  }, [selectedWarehouse]);

  const filteredItems = lowStockFilter
    ? inventory.filter((item) => item.quantity <= item.reorderLevel)
    : inventory;

  const stats = {
    totalItems: inventory.length,
    lowStockItems: inventory.filter((item) => item.quantity <= item.reorderLevel)
      .length,
    totalValue: inventory.reduce(
      (sum, item) => sum + (item.quantity * 100), // Assuming $100 per unit for now
      0
    ),
    averageStock: inventory.length > 0
      ? Math.round(inventory.reduce((sum, item) => sum + item.quantity, 0) / inventory.length)
      : 0,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Track and manage stock levels across warehouses</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <Plus size={20} />
          Add Inventory
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Items</p>
              <p className="text-2xl font-bold mt-1">{stats.totalItems}</p>
            </div>
            <Package className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Low Stock</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">
                {stats.lowStockItems}
              </p>
            </div>
            <AlertTriangle className="text-orange-500" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Inventory Value</p>
              <p className="text-2xl font-bold mt-1">${(stats.totalValue / 1000).toFixed(1)}K</p>
            </div>
            <TrendingDown className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Avg Stock Level</p>
              <p className="text-2xl font-bold mt-1">{stats.averageStock}</p>
            </div>
            <Warehouse className="text-purple-500" size={24} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 flex justify-between items-center">
        <div className="flex gap-4">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} - {wh.location}
              </option>
            ))}
          </select>

          <button
            onClick={() => setLowStockFilter(!lowStockFilter)}
            className={`px-3 py-2 rounded text-sm font-medium ${
              lowStockFilter
                ? "bg-orange-100 text-orange-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            <AlertTriangle size={16} className="inline mr-1" />
            Low Stock Only
          </button>
        </div>

        <button
          onClick={fetchInventory}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Quantity
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Reserved
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Available
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Reorder Level
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <RefreshCw className="animate-spin text-blue-600" />
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No inventory items found
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLowStock = item.quantity <= item.reorderLevel;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-gray-200 hover:bg-gray-50 ${
                        isLowStock ? "bg-orange-50" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-sm">{item.productId}</td>
                      <td className="px-6 py-4 text-sm">{item.warehouseId}</td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">{item.reserved}</td>
                      <td className="px-6 py-4 text-right text-sm text-green-600 font-medium">
                        {item.available}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">{item.reorderLevel}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            isLowStock
                              ? "bg-orange-100 text-orange-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {isLowStock ? "Low Stock" : "In Stock"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                          <ArrowRightLeft size={16} />
                          Transfer
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Movements */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-4">Recent Stock Movements</h2>
        <div className="space-y-2">
          {movements.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent movements</p>
          ) : (
            movements.map((movement) => (
              <div
                key={movement.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded"
              >
                <div>
                  <p className="text-sm font-medium capitalize">{movement.type}</p>
                  <p className="text-xs text-gray-500">{movement.reason}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${
                      movement.quantityChanged > 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {movement.quantityChanged > 0 ? "+" : ""}
                    {movement.quantityChanged}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(movement.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
