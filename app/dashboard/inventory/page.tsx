'use client';

import { useState, useEffect } from 'react';

interface InventoryItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  available: number;
  created_at: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const response = await fetch('/api/inventory?page=0&pageSize=20');
        if (!response.ok) throw new Error('Failed to fetch inventory');
        const data = await response.json();
        setInventory(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load inventory');
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, []);

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
                <th className="px-6 py-3 text-left font-semibold">Product ID</th>
                <th className="px-6 py-3 text-left font-semibold">Warehouse ID</th>
                <th className="px-6 py-3 text-left font-semibold">Quantity</th>
                <th className="px-6 py-3 text-left font-semibold">Available</th>
                <th className="px-6 py-3 text-left font-semibold">Created</th>
                <th className="px-6 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No inventory items found
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">{item.product_id.slice(0, 8)}...</td>
                    <td className="px-6 py-4 font-mono text-sm">{item.warehouse_id.slice(0, 8)}...</td>
                    <td className="px-6 py-4">{item.quantity}</td>
                    <td className="px-6 py-4">{item.available}</td>
                    <td className="px-6 py-4">{new Date(item.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <button className="text-blue-600 hover:text-blue-800 mr-4">Adjust</button>
                      <button className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
