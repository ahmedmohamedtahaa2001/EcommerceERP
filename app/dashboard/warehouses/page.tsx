"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Warehouse {
  id: string;
  name: string;
  address: { city?: string; street?: string; country?: string } | null;
  capacity: number;
  current_utilization: number;
  utilization_percentage: number;
  created_at: string;
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch("/api/warehouses?page=0&pageSize=20");
        if (!response.ok) throw new Error("Failed to fetch warehouses");
        const data = await response.json();
        setWarehouses(data.data || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load warehouses",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchWarehouses();
  }, []);

  const getCapacityColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-100";
    if (percentage >= 70) return "bg-yellow-100";
    return "bg-green-100";
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Warehouses</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Add Warehouse
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
                <th className="px-6 py-3 text-left font-semibold">Name</th>
                <th className="px-6 py-3 text-left font-semibold">Location</th>
                <th className="px-6 py-3 text-left font-semibold">Capacity</th>
                <th className="px-6 py-3 text-left font-semibold">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left font-semibold">Usage</th>
                <th className="px-6 py-3 text-left font-semibold">Created</th>
                <th className="px-6 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No warehouses found
                  </td>
                </tr>
              ) : (
                warehouses.map((warehouse) => {
                  const percentage = Math.round(
                    warehouse.utilization_percentage || 0,
                  );
                  const location = warehouse.address
                    ? [warehouse.address.city, warehouse.address.country]
                        .filter(Boolean)
                        .join(", ")
                    : "-";
                  return (
                    <tr
                      key={warehouse.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-semibold">
                        {warehouse.name}
                      </td>
                      <td className="px-6 py-4">{location}</td>
                      <td className="px-6 py-4">{warehouse.capacity}</td>
                      <td className="px-6 py-4">
                        {warehouse.current_utilization}
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className={`px-3 py-1 rounded text-sm font-medium text-center ${getCapacityColor(percentage)}`}
                        >
                          {percentage}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {new Date(warehouse.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/warehouses/${warehouse.id}`}
                          className="text-green-600 hover:text-green-800 mr-4"
                        >
                          Bins
                        </Link>
                        <button className="text-blue-600 hover:text-blue-800 mr-4">
                          Edit
                        </button>
                        <button className="text-red-600 hover:text-red-800">
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
