'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
}

export default function DashboardPage() {
  // Show demo data for now - we'll integrate with Supabase data later
  const metrics = {
    totalRevenue: 125750.50,
    totalOrders: 342,
    totalCustomers: 89,
    totalProducts: 156,
  };

  const metricCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(metrics.totalRevenue),
      icon: '💰',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Total Orders',
      value: metrics.totalOrders,
      icon: '📦',
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Total Customers',
      value: metrics.totalCustomers,
      icon: '👥',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Total Products',
      value: metrics.totalProducts,
      icon: '🛍️',
      color: 'bg-orange-100 text-orange-600',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome to your ERP system</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 text-sm font-medium">{card.title}</h3>
              <span className="text-2xl">{card.icon}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            <div className={`mt-4 px-3 py-1 rounded-full inline-block text-sm font-medium ${card.color}`}>
              Active
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <a href="/dashboard/products" className="block p-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 font-medium transition">
              ➕ Add New Product
            </a>
            <a href="/dashboard/orders" className="block p-3 bg-green-50 hover:bg-green-100 rounded-lg text-green-600 font-medium transition">
              ➕ Create New Order
            </a>
            <a href="/dashboard/customers" className="block p-3 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-600 font-medium transition">
              ➕ Add New Customer
            </a>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">System Info</h2>
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">
              <span className="font-medium">Version:</span> 1.0.0
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Status:</span>{' '}
              <span className="text-green-600 font-medium">Active</span>
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Last Sync:</span> Just now
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Documentation:</span>{' '}
              <a href="#" className="text-blue-600 hover:underline">
                View Docs
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
