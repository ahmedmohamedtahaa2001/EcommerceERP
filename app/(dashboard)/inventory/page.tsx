'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import type { InventoryItem } from '@/types';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch warehouses
        const { data: whData } = await supabase.from('warehouses').select('*');
        setWarehouses(whData || []);
        if (whData && whData.length > 0) {
          setSelectedWarehouse(whData[0].id);
        }

        // Fetch inventory with product info
        const { data: invData } = await supabase
          .from('inventory')
          .select('*, products(name, sku, price), warehouses(name)');

        setInventory(invData || []);
      } catch (error) {
        console.error('Error fetching inventory:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredInventory = selectedWarehouse
    ? inventory.filter(item => item.warehouse_id === selectedWarehouse)
    : inventory;

  const lowStockItems = filteredInventory.filter(item => item.available <= item.reorder_level);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-gray-600 text-sm mt-1">Track stock levels across warehouses</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Total Items</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{filteredInventory.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Total Quantity</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {filteredInventory.reduce((sum, item) => sum + item.quantity, 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Low Stock Alerts</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{lowStockItems.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Total Value</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {formatCurrency(
              filteredInventory.reduce(
                (sum, item) => sum + item.quantity * (item.products?.price || 0),
                0
              )
            )}
          </p>
        </div>
      </div>

      {/* Warehouse Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse</label>
        <select
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Warehouses</option>
          {warehouses.map(wh => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Loading inventory...</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No inventory items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Warehouse</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Quantity</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Reserved</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Available</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Reorder Level</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{item.products?.name}</p>
                        <p className="text-sm text-gray-500">{item.products?.sku}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.warehouses?.name}</td>
                    <td className="px-6 py-4 font-medium">{item.quantity}</td>
                    <td className="px-6 py-4 text-gray-600">{item.reserved}</td>
                    <td className="px-6 py-4 font-medium">{item.available}</td>
                    <td className="px-6 py-4 text-gray-600">{item.reorder_level}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          item.available <= item.reorder_level
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {item.available <= item.reorder_level ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="font-bold text-red-900 mb-3">⚠️ Low Stock Alert</h3>
          <ul className="space-y-2">
            {lowStockItems.slice(0, 5).map(item => (
              <li key={item.id} className="text-sm text-red-700">
                {item.products?.name} - Only {item.available} units available in {item.warehouses?.name}
              </li>
            ))}
          </ul>
          {lowStockItems.length > 5 && (
            <p className="text-sm text-red-700 mt-2">
              ... and {lowStockItems.length - 5} more items
            </p>
          )}
        </div>
      )}
    </div>
  );
}
