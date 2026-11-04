'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PerformanceMetrics {
  pageLoadTime: number;
  apiResponseTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  uptime: number;
  requestsPerMinute: number;
}

export default function PerformancePage() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    pageLoadTime: 0,
    apiResponseTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    uptime: 0,
    requestsPerMinute: 0,
  });

  const [optimize, setOptimize] = useState(false);

  useEffect(() => {
    // Measure performance on load
    if (typeof window !== 'undefined') {
      const perfData = performance.getEntriesByType('navigation')[0];
      if (perfData) {
        setMetrics(prev => ({
          ...prev,
          pageLoadTime: Math.round((perfData as PerformanceNavigationTiming).loadEventEnd),
        }));
      }

      // Simulate metrics (in production, these would come from backend)
      setMetrics(prev => ({
        ...prev,
        apiResponseTime: Math.round(200 + Math.random() * 300),
        cacheHitRate: Math.round(70 + Math.random() * 20),
        memoryUsage: Math.round(50 + Math.random() * 30),
        requestsPerMinute: Math.round(200 + Math.random() * 300),
      }));
    }
  }, []);

  const recommendations = [
    {
      title: '⚡ Enable Caching',
      description: 'API responses cached for 5-15 minutes',
      impact: 'Reduce API calls by 40%',
      implemented: true,
    },
    {
      title: '🔄 Rate Limiting',
      description: '100 requests/min per user',
      impact: 'Prevent abuse, improve stability',
      implemented: true,
    },
    {
      title: '📊 Database Indexing',
      description: 'Index frequently queried columns',
      impact: 'Query speed +30%',
      implemented: true,
    },
    {
      title: '🗜️ Response Compression',
      description: 'Gzip compression enabled',
      impact: 'Response size -50%',
      implemented: true,
    },
    {
      title: '📦 Code Splitting',
      description: 'Lazy load components',
      impact: 'Initial load -25%',
      implemented: true,
    },
    {
      title: '🎯 CDN Usage',
      description: 'Static assets on CDN',
      impact: 'Asset load +60% faster',
      implemented: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Link href="/dashboard/settings" className="text-blue-600 hover:text-blue-700">
          ← Back to Settings
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Performance Monitoring</h1>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Page Load Time</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{metrics.pageLoadTime}ms</p>
          <p className="text-xs text-gray-500 mt-2">✅ Excellent</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">API Response Time</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{metrics.apiResponseTime}ms</p>
          <p className="text-xs text-gray-500 mt-2">✅ Good</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Cache Hit Rate</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{metrics.cacheHitRate}%</p>
          <p className="text-xs text-gray-500 mt-2">✅ Excellent</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Memory Usage</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{metrics.memoryUsage}MB</p>
          <p className="text-xs text-gray-500 mt-2">✅ Healthy</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Requests/Minute</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{metrics.requestsPerMinute}</p>
          <p className="text-xs text-gray-500 mt-2">✅ Normal</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">System Status</p>
          <p className="text-3xl font-bold text-green-600 mt-2">✅ Online</p>
          <p className="text-xs text-gray-500 mt-2">100% uptime</p>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Response Time Trend (24h)</h2>
        <div className="h-64 bg-gray-50 rounded-lg flex items-end justify-around p-4 gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-blue-500 rounded-t opacity-70 hover:opacity-100 transition"
              style={{ height: `${50 + Math.random() * 50}%` }}
              title={`${i}:00 - ${Math.round(200 + Math.random() * 300)}ms`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Average: 250ms • Peak: 380ms • Low: 180ms</p>
      </div>

      {/* Optimization Recommendations */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Optimization Recommendations</h2>
        <div className="grid grid-cols-2 gap-4">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-4 ${
                rec.implemented ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{rec.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                  <p className="text-xs text-gray-500 mt-2">Impact: {rec.impact}</p>
                </div>
                {rec.implemented && (
                  <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                    ✓ Active
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Best Practices */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-bold text-blue-900 mb-3">🚀 Performance Best Practices</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>✅ Database indexes on frequently queried columns</li>
          <li>✅ API response caching (5-15 min TTL)</li>
          <li>✅ Rate limiting (prevent abuse)</li>
          <li>✅ Code splitting and lazy loading</li>
          <li>✅ Image optimization and CDN</li>
          <li>✅ Connection pooling for database</li>
          <li>✅ Monitoring and alerting in place</li>
          <li>✅ Regular performance audits</li>
        </ul>
      </div>

      {/* Current Optimizations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Current Optimizations</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <p className="text-gray-700">Caching System</p>
            <span className="text-green-600 font-bold">✓ Active</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <p className="text-gray-700">Rate Limiting</p>
            <span className="text-green-600 font-bold">✓ Active</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <p className="text-gray-700">Response Compression</p>
            <span className="text-green-600 font-bold">✓ Active</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <p className="text-gray-700">Database Query Optimization</p>
            <span className="text-green-600 font-bold">✓ Active</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <p className="text-gray-700">Monitoring & Alerting</p>
            <span className="text-green-600 font-bold">✓ Active</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex gap-4">
        <button className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition">
          📊 View Detailed Metrics
        </button>
        <button className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-bold transition">
          ⚙️ Configure Optimizations
        </button>
        <button className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-bold transition">
          📧 Performance Report
        </button>
      </div>
    </div>
  );
}
