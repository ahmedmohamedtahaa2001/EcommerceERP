'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase';

type OperationType = 'price-update' | 'status-change' | 'bulk-delete' | 'bulk-email' | 'batch-order';

interface BulkOperation {
  type: OperationType;
  label: string;
  description: string;
  icon: string;
  color: string;
}

interface OperationResult {
  success: number;
  failed: number;
  skipped: number;
  totalTime: number;
}

export default function BulkOperationsPage() {
  const [selectedOperation, setSelectedOperation] = useState<OperationType | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState('');

  // Bulk price update state
  const [priceIncrease, setPriceIncrease] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Bulk status change state
  const [newStatus, setNewStatus] = useState('active');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const operations: BulkOperation[] = [
    {
      type: 'price-update',
      label: '💰 Bulk Price Update',
      description: 'Update prices for multiple products at once',
      icon: '💰',
      color: 'text-green-600',
    },
    {
      type: 'status-change',
      label: '🔄 Bulk Status Change',
      description: 'Change product or order status in bulk',
      icon: '🔄',
      color: 'text-blue-600',
    },
    {
      type: 'bulk-delete',
      label: '🗑️ Bulk Delete',
      description: 'Delete multiple items with confirmation',
      icon: '🗑️',
      color: 'text-red-600',
    },
    {
      type: 'bulk-email',
      label: '📧 Bulk Email Export',
      description: 'Export customer emails for campaigns',
      icon: '📧',
      color: 'text-purple-600',
    },
    {
      type: 'batch-order',
      label: '📦 Batch Order Creation',
      description: 'Create multiple orders from template',
      icon: '📦',
      color: 'text-orange-600',
    },
  ];

  const handleBulkPriceUpdate = async () => {
    setLoading(true);
    setError('');
    const startTime = Date.now();

    try {
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .in('id', selectedProducts.length > 0 ? selectedProducts : undefined);

      if (!products || products.length === 0) {
        setError('No products selected');
        setLoading(false);
        return;
      }

      const updates = products.map(p => ({
        id: p.id,
        price: Math.round(p.price * (1 + priceIncrease / 100) * 100) / 100,
      }));

      let success = 0;
      let failed = 0;

      for (const update of updates) {
        try {
          await supabase.from('products').update(update).eq('id', update.id);
          success++;
        } catch {
          failed++;
        }
      }

      setResult({
        success,
        failed,
        skipped: products.length - success - failed,
        totalTime: Date.now() - startTime,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStatusChange = async () => {
    setLoading(true);
    setError('');
    const startTime = Date.now();

    try {
      const resourceType = selectedOperation === 'status-change' ? 'products' : 'orders';
      const ids = selectedIds.length > 0 ? selectedIds : [];

      if (ids.length === 0) {
        setError('No items selected');
        setLoading(false);
        return;
      }

      let success = 0;
      let failed = 0;

      for (const id of ids) {
        try {
          await supabase
            .from(resourceType)
            .update({ active: newStatus === 'active' })
            .eq('id', id);
          success++;
        } catch {
          failed++;
        }
      }

      setResult({
        success,
        failed,
        skipped: ids.length - success - failed,
        totalTime: Date.now() - startTime,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm('Are you sure? This action cannot be undone.')) return;

    setLoading(true);
    setError('');
    const startTime = Date.now();

    try {
      const ids = selectedIds.length > 0 ? selectedIds : [];
      let success = 0;
      let failed = 0;

      for (const id of ids) {
        try {
          await supabase.from('products').delete().eq('id', id);
          success++;
        } catch {
          failed++;
        }
      }

      setResult({
        success,
        failed,
        skipped: ids.length - success - failed,
        totalTime: Date.now() - startTime,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkEmailExport = async () => {
    setLoading(true);
    setError('');
    const startTime = Date.now();

    try {
      const { data: customers } = await supabase.from('customers').select('email');

      if (!customers || customers.length === 0) {
        setError('No customers found');
        setLoading(false);
        return;
      }

      const emails = customers.map(c => c.email).join('\n');
      const blob = new Blob([emails], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customer-emails-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setResult({
        success: customers.length,
        failed: 0,
        skipped: 0,
        totalTime: Date.now() - startTime,
      });
    } catch (err: any) {
      setError(err.message);
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
        <h1 className="text-3xl font-bold text-gray-900">Bulk Operations</h1>
      </div>

      <p className="text-gray-600">
        Perform operations on multiple items at once. Perfect for large-scale updates.
      </p>

      {/* Operation Selection */}
      {!selectedOperation ? (
        <div className="grid grid-cols-2 gap-4">
          {operations.map(op => (
            <button
              key={op.type}
              onClick={() => setSelectedOperation(op.type)}
              className="p-6 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left space-y-2"
            >
              <p className="text-2xl">{op.icon}</p>
              <p className="font-bold text-gray-900">{op.label}</p>
              <p className="text-sm text-gray-600">{op.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {operations.find(o => o.type === selectedOperation)?.label}
            </h2>
            <button
              onClick={() => {
                setSelectedOperation(null);
                setResult(null);
                setError('');
              }}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          {/* Bulk Price Update */}
          {selectedOperation === 'price-update' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Adjustment (%)
                </label>
                <input
                  type="number"
                  value={priceIncrease}
                  onChange={(e) => setPriceIncrease(parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 10 for +10%, -5 for -5%"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use negative values to decrease prices
                </p>
              </div>

              <button
                onClick={handleBulkPriceUpdate}
                disabled={loading}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-bold transition"
              >
                {loading ? '⏳ Processing...' : '💰 Update All Prices'}
              </button>
            </div>
          )}

          {/* Bulk Status Change */}
          {selectedOperation === 'status-change' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <button
                onClick={handleBulkStatusChange}
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-bold transition"
              >
                {loading ? '⏳ Processing...' : '🔄 Change Status'}
              </button>
            </div>
          )}

          {/* Bulk Delete */}
          {selectedOperation === 'bulk-delete' && (
            <div className="space-y-4 bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-red-900 font-bold">⚠️ Warning: This action cannot be undone</p>
              <button
                onClick={handleBulkDelete}
                disabled={loading}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-bold transition"
              >
                {loading ? '⏳ Processing...' : '🗑️ Delete Selected Items'}
              </button>
            </div>
          )}

          {/* Bulk Email Export */}
          {selectedOperation === 'bulk-email' && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Export all customer emails to a file for email marketing campaigns.
              </p>
              <button
                onClick={handleBulkEmailExport}
                disabled={loading}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-bold transition"
              >
                {loading ? '⏳ Processing...' : '📧 Export Customer Emails'}
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              ❌ {error}
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <p className="font-bold text-green-900">✅ Operation Complete</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600">{result.success}</p>
                </div>
                <div>
                  <p className="text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                </div>
                <div>
                  <p className="text-gray-600">Time</p>
                  <p className="text-2xl font-bold text-blue-600">{result.totalTime}ms</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Boxes */}
      {!selectedOperation && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-bold text-blue-900 mb-2">💡 Best Practices</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Test with small sample first</li>
              <li>• Backup data before bulk operations</li>
              <li>• Review changes carefully</li>
              <li>• Track operation results</li>
            </ul>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-bold text-green-900 mb-2">⚡ Performance</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Operations process efficiently</li>
              <li>• Batch processing supported</li>
              <li>• Real-time progress tracking</li>
              <li>• Undo capability (future)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
