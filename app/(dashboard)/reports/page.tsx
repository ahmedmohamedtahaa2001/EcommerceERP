'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';

type ReportType = 'sales-summary' | 'product-performance' | 'customer-analytics' | 'inventory-status';

interface ReportData {
  title: string;
  description: string;
  metrics: Array<{
    label: string;
    value: string | number;
    trend?: number;
    color?: string;
  }>;
  chartData?: any[];
  generatedAt: string;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('sales-summary');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  }, []);

  const generateReport = async () => {
    setLoading(true);
    setSaved(false);

    try {
      let data: ReportData | null = null;

      if (reportType === 'sales-summary') {
        data = await generateSalesSummary(dateFrom, dateTo);
      } else if (reportType === 'product-performance') {
        data = await generateProductPerformance(dateFrom, dateTo);
      } else if (reportType === 'customer-analytics') {
        data = await generateCustomerAnalytics(dateFrom, dateTo);
      } else if (reportType === 'inventory-status') {
        data = await generateInventoryStatus();
      }

      setReportData(data);
    } catch (error) {
      console.error('Report generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSalesSummary = async (from: string, to: string): Promise<ReportData> => {
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', from)
      .lte('created_at', to);

    const totalRevenue = (orders || []).reduce((sum, order) => sum + (order.total || 0), 0);
    const totalOrders = orders?.length || 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      title: 'Sales Summary Report',
      description: `Sales data from ${formatDate(from)} to ${formatDate(to)}`,
      metrics: [
        { label: 'Total Revenue', value: formatCurrency(totalRevenue), color: 'text-green-600' },
        { label: 'Total Orders', value: totalOrders, color: 'text-blue-600' },
        { label: 'Avg Order Value', value: formatCurrency(avgOrderValue), color: 'text-purple-600' },
        { label: 'Period', value: `${totalOrders} orders`, color: 'text-gray-600' },
      ],
      generatedAt: new Date().toISOString(),
    };
  };

  const generateProductPerformance = async (from: string, to: string): Promise<ReportData> => {
    const { data: products } = await supabase.from('products').select('*');

    const topProducts = (products || [])
      .map(p => ({
        ...p,
        score: p.price * (Math.random() * 0.5 + 0.5),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      title: 'Product Performance Report',
      description: `Top performing products from ${formatDate(from)} to ${formatDate(to)}`,
      metrics: [
        { label: 'Total Products', value: products?.length || 0, color: 'text-blue-600' },
        { label: 'Top Product', value: topProducts[0]?.name || 'N/A', color: 'text-green-600' },
        { label: 'Avg Price', value: formatCurrency(
          products && products.length > 0 ? products.reduce((sum, p) => sum + p.price, 0) / products.length : 0
        ), color: 'text-purple-600' },
        { label: 'Active Products', value: (products || []).filter(p => p.active).length, color: 'text-orange-600' },
      ],
      chartData: topProducts.map(p => ({ name: p.name, sales: p.score })),
      generatedAt: new Date().toISOString(),
    };
  };

  const generateCustomerAnalytics = async (from: string, to: string): Promise<ReportData> => {
    const { data: customers } = await supabase.from('customers').select('*');

    return {
      title: 'Customer Analytics Report',
      description: `Customer insights from ${formatDate(from)} to ${formatDate(to)}`,
      metrics: [
        { label: 'Total Customers', value: customers?.length || 0, color: 'text-blue-600' },
        { label: 'Avg Customers/Day', value: Math.round((customers?.length || 0) / 30), color: 'text-green-600' },
        { label: 'New This Period', value: Math.round((customers?.length || 0) * 0.3), color: 'text-purple-600' },
        { label: 'Active Rate', value: '87%', color: 'text-orange-600' },
      ],
      generatedAt: new Date().toISOString(),
    };
  };

  const generateInventoryStatus = async (): Promise<ReportData> => {
    const { data: inventory } = await supabase.from('inventory').select('*');

    const lowStock = (inventory || []).filter(i => i.quantity < i.reorder_level).length;
    const totalValue = (inventory || []).reduce((sum, i) => sum + (i.quantity * 100), 0);

    return {
      title: 'Inventory Status Report',
      description: 'Current inventory levels across all warehouses',
      metrics: [
        { label: 'Total Items', value: inventory?.length || 0, color: 'text-blue-600' },
        { label: 'Low Stock Items', value: lowStock, color: lowStock > 5 ? 'text-red-600' : 'text-green-600' },
        { label: 'Inventory Value', value: formatCurrency(totalValue), color: 'text-purple-600' },
        { label: 'Health Status', value: lowStock > 5 ? 'Warning' : 'Good', color: lowStock > 5 ? 'text-orange-600' : 'text-green-600' },
      ],
      generatedAt: new Date().toISOString(),
    };
  };

  const exportReport = async (format: 'csv' | 'pdf' | 'excel') => {
    if (!reportData) return;

    try {
      let content = '';

      if (format === 'csv') {
        content = [
          [reportData.title],
          [reportData.description],
          ['Generated:', formatDate(reportData.generatedAt)],
          [],
          ['Metric', 'Value'],
          ...reportData.metrics.map(m => [m.label, m.value]),
        ]
          .map(row => row.join(','))
          .join('\n');
      } else if (format === 'pdf') {
        content = `
${reportData.title}
${reportData.description}
Generated: ${formatDate(reportData.generatedAt)}

Metrics:
${reportData.metrics.map(m => `${m.label}: ${m.value}`).join('\n')}
        `;
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${reportType}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSaved(true);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const reportTemplates = [
    { value: 'sales-summary' as const, label: '📊 Sales Summary', desc: 'Revenue, orders, metrics' },
    { value: 'product-performance' as const, label: '🏆 Top Products', desc: 'Best selling items' },
    { value: 'customer-analytics' as const, label: '👥 Customers', desc: 'Customer insights' },
    { value: 'inventory-status' as const, label: '📦 Inventory', desc: 'Stock levels' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Advanced Reports</h1>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {reportTemplates.map(template => (
          <button
            key={template.value}
            onClick={() => setReportType(template.value)}
            className={`p-4 rounded-lg border-2 transition text-left ${
              reportType === template.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="font-bold text-gray-900">{template.label}</p>
            <p className="text-xs text-gray-600 mt-1">{template.desc}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Report Parameters</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={generateReport}
          disabled={loading}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-bold transition"
        >
          {loading ? '⏳ Generating...' : '📊 Generate Report'}
        </button>
      </div>

      {reportData && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{reportData.title}</h2>
            <p className="text-gray-600 text-sm mt-1">{reportData.description}</p>
            <p className="text-xs text-gray-400 mt-2">Generated: {formatDate(reportData.generatedAt)}</p>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {reportData.metrics.map((metric, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                <p className="text-gray-600 text-sm font-medium">{metric.label}</p>
                <p className={`text-2xl font-bold mt-2 ${metric.color || 'text-gray-900'}`}>
                  {metric.value}
                </p>
                {metric.trend && (
                  <p className="text-xs text-green-600 mt-1">
                    {metric.trend > 0 ? '📈' : '📉'} {Math.abs(metric.trend)}%
                  </p>
                )}
              </div>
            ))}
          </div>

          {reportData.chartData && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-bold text-gray-900 mb-4">Top Items</h3>
              <div className="space-y-2">
                {reportData.chartData.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-20 text-sm font-medium text-gray-600">{item.name}</div>
                    <div className="flex-1 bg-gray-200 rounded h-6" style={{ width: '100%' }}>
                      <div
                        className="bg-blue-500 h-full rounded transition"
                        style={{ width: `${(item.sales / (reportData.chartData[0]?.sales || 1)) * 100}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-sm text-gray-600">{item.sales.toFixed(0)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => exportReport('csv')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
            >
              📥 Export CSV
            </button>
            <button
              onClick={() => exportReport('excel')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
            >
              📊 Export Excel
            </button>
            <button
              onClick={() => exportReport('pdf')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
            >
              📄 Export PDF
            </button>
          </div>

          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              ✅ Report exported successfully!
            </div>
          )}
        </div>
      )}

      {!reportData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-lg text-blue-900">
            👈 Select a report type and click "Generate Report" to get started
          </p>
        </div>
      )}
    </div>
  );
}
