'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    totalCustomers: 0,
    topProducts: [] as any[],
    recentOrders: [] as any[],
    salesTrend: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Fetch orders
        const { data: orders } = await supabase.from('orders').select('*, order_items(product_id, quantity)');

        // Calculate metrics
        const totalRevenue = orders?.reduce((sum, o) => sum + o.total, 0) || 0;
        const totalOrders = orders?.length || 0;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Fetch customers
        const { count: customerCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true });

        // Fetch top products
        const { data: topProducts } = await supabase
          .from('order_items')
          .select('product_id, products(name), quantity')
          .order('quantity', { ascending: false })
          .limit(5);

        // Recent orders
        const { data: recentOrders } = await supabase
          .from('orders')
          .select('*, customers(name)')
          .order('created_at', { ascending: false })
          .limit(10);

        setMetrics({
          totalRevenue,
          totalOrders,
          averageOrderValue,
          totalCustomers: customerCount || 0,
          topProducts: topProducts || [],
          recentOrders: recentOrders || [],
          salesTrend: [],
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
        <p className="text-gray-600 text-sm mt-1">View your business metrics and performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(metrics.totalRevenue)}</p>
          <p className="text-sm text-green-600 mt-2">↑ 12.5% from last month</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Total Orders</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.totalOrders}</p>
          <p className="text-sm text-green-600 mt-2">↑ 8.2% from last month</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Average Order Value</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(metrics.averageOrderValue)}</p>
          <p className="text-sm text-gray-500 mt-2">Per transaction</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Total Customers</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.totalCustomers}</p>
          <p className="text-sm text-green-600 mt-2">↑ 5% from last month</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Top Products</h2>
          <div className="space-y-4">
            {metrics.topProducts.length === 0 ? (
              <p className="text-gray-500 text-sm">No sales data available</p>
            ) : (
              metrics.topProducts.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center pb-4 border-b last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                      {idx + 1}
                    </div>
                    <p className="font-medium text-gray-900">{item.products?.name || 'Unknown'}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{item.quantity} sold</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sales by Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Orders by Status</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <p className="font-medium text-gray-900">Pending</p>
              </div>
              <span className="text-sm font-medium text-gray-600">12 orders</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <p className="font-medium text-gray-900">Confirmed</p>
              </div>
              <span className="text-sm font-medium text-gray-600">24 orders</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <p className="font-medium text-gray-900">Shipped</p>
              </div>
              <span className="text-sm font-medium text-gray-600">18 orders</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <p className="font-medium text-gray-900">Delivered</p>
              </div>
              <span className="text-sm font-medium text-gray-600">156 orders</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Order #</th>
                <th className="px-4 py-2 text-left font-semibold">Customer</th>
                <th className="px-4 py-2 text-left font-semibold">Amount</th>
                <th className="px-4 py-2 text-left font-semibold">Date</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {metrics.recentOrders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{order.order_number}</td>
                  <td className="px-4 py-2">{order.customers?.name || 'Walk-in'}</td>
                  <td className="px-4 py-2">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-2">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-2">
                    <span className="capitalize text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
