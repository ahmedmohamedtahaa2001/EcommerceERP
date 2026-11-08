'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';

type ExportType = 'products' | 'customers' | 'orders' | 'inventory';
type ExportFormat = 'csv' | 'excel';

interface ExportOptions {
  type: ExportType;
  format: ExportFormat;
  dateFrom: string;
  dateTo: string;
  columns: string[];
}

export default function ExportPage() {
  const [exportType, setExportType] = useState<ExportType>('products');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const columnOptions: Record<ExportType, { label: string; value: string }[]> = {
    products: [
      { label: 'SKU', value: 'sku' },
      { label: 'Name', value: 'name' },
      { label: 'Description', value: 'description' },
      { label: 'Price', value: 'price' },
      { label: 'Cost', value: 'cost' },
      { label: 'Active', value: 'active' },
    ],
    customers: [
      { label: 'Name', value: 'name' },
      { label: 'Email', value: 'email' },
      { label: 'Phone', value: 'phone' },
      { label: 'City', value: 'city' },
      { label: 'Country', value: 'country' },
      { label: 'Total Orders', value: 'total_orders' },
      { label: 'Total Spent', value: 'total_spent' },
    ],
    orders: [
      { label: 'Order Number', value: 'order_number' },
      { label: 'Customer', value: 'customer_id' },
      { label: 'Total', value: 'total' },
      { label: 'Status', value: 'status' },
      { label: 'Payment Status', value: 'payment_status' },
      { label: 'Date', value: 'created_at' },
    ],
    inventory: [
      { label: 'Product', value: 'product_id' },
      { label: 'Warehouse', value: 'warehouse_id' },
      { label: 'Quantity', value: 'quantity' },
      { label: 'Reserved', value: 'reserved' },
      { label: 'Available', value: 'available' },
      { label: 'Reorder Level', value: 'reorder_level' },
    ],
  };

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let data: any[] = [];

      if (exportType === 'products') {
        const { data: products } = await supabase.from('products').select('*');
        data = products || [];
      } else if (exportType === 'customers') {
        const { data: customers } = await supabase.from('customers').select('*');
        data = customers || [];
      } else if (exportType === 'orders') {
        const { data: orders } = await supabase.from('orders').select('*');
        data = orders || [];
      } else if (exportType === 'inventory') {
        const { data: inventory } = await supabase.from('inventory').select('*');
        data = inventory || [];
      }

      if (data.length === 0) {
        setError('No data to export');
        setLoading(false);
        return;
      }

      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map(row =>
          headers
            .map(header => {
              const value = row[header];
              if (value === null || value === undefined) return '';
              if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
              }
              return value;
            })
            .join(',')
        ),
      ].join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `${exportType}-export-${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess(`Successfully exported ${data.length} records`);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Export Data</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Export Type Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">What to Export</h2>
            <div className="grid grid-cols-2 gap-4">
              {(['products', 'customers', 'orders', 'inventory'] as const).map(type => (
                <label
                  key={type}
                  className="p-4 border-2 rounded-lg cursor-pointer transition flex items-center gap-3"
                  style={{
                    borderColor: exportType === type ? '#2563eb' : '#e5e7eb',
                    backgroundColor: exportType === type ? '#eff6ff' : 'white',
                  }}
                >
                  <input
                    type="radio"
                    name="exportType"
                    value={type}
                    checked={exportType === type}
                    onChange={(e) => setExportType(e.target.value as ExportType)}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{type}</p>
                    <p className="text-xs text-gray-500">Export all {type}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Export Format</h2>
            <div className="space-y-2">
              {(['csv', 'excel'] as const).map(fmt => (
                <label key={fmt} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition">
                  <input
                    type="radio"
                    name="format"
                    value={fmt}
                    checked={format === fmt}
                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{fmt.toUpperCase()}</p>
                    <p className="text-sm text-gray-600">
                      {fmt === 'csv'
                        ? 'Comma-separated values for Excel/Sheets'
                        : 'Excel format with formatting'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Column Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Select Columns</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {columnOptions[exportType].map(col => (
                <label key={col.value} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                  <span className="text-gray-700">{col.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                Select All
              </button>
              <button className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                Clear All
              </button>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Export Info</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-900">📊 What's Included</p>
                <p>All {exportType} data from your system</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">📋 Format</p>
                <p>{format.toUpperCase()} file download</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">⏱️ Time</p>
                <p>Takes 1-5 seconds</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition text-lg"
          >
            {loading ? '⏳ Exporting...' : '⬇️ Export Now'}
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              💡 <strong>Tip:</strong> You can export your data at any time. Exports are CSV format by default.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-600">
              📅 Export generated on {formatDate(new Date().toISOString())}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
