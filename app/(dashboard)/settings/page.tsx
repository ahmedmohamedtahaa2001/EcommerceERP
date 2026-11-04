'use client';

import Link from 'next/link';

export default function SettingsPage() {
  const settingsSections = [
    {
      title: 'Users & Permissions',
      description: 'Manage team members and their access levels',
      icon: '👥',
      href: '/dashboard/settings/users',
      features: ['Create users', 'Manage roles', 'Activity log']
    },
    {
      title: 'API Keys',
      description: 'Generate and manage API keys for integrations',
      icon: '🔑',
      href: '/dashboard/settings/api-keys',
      features: ['Generate keys', 'View usage', 'Revoke access']
    },
    {
      title: 'Audit Log',
      description: 'View system events and user actions',
      icon: '📋',
      href: '/dashboard/settings/audit-log',
      features: ['Track changes', 'View events', 'Export log']
    },
    {
      title: 'Company Settings',
      description: 'Configure company information and preferences',
      icon: '🏢',
      href: '/dashboard/settings/company',
      features: ['Company info', 'Preferences', 'Integrations']
    },
    {
      title: 'Data Import/Export',
      description: 'Bulk import or export data',
      icon: '📊',
      href: '/dashboard/import',
      features: ['CSV import', 'Data export', 'Backup']
    },
    {
      title: 'Security',
      description: 'Configure security settings and two-factor authentication',
      icon: '🔒',
      href: '/dashboard/settings/security',
      features: ['Password policy', '2FA', 'IP whitelist']
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 text-sm mt-1">Manage your system, users, and preferences</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Active Users</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
          <p className="text-xs text-gray-500 mt-1">In your workspace</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">API Keys</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
          <p className="text-xs text-gray-500 mt-1">Active integrations</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Security Level</p>
          <p className="text-3xl font-bold text-green-600 mt-2">Good</p>
          <p className="text-xs text-gray-500 mt-1">All systems secure</p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingsSections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            className="group bg-white rounded-lg shadow hover:shadow-lg transition p-6 border border-gray-200 hover:border-blue-500"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-4xl">{section.icon}</div>
              <span className="text-gray-400 group-hover:text-blue-500">→</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{section.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{section.description}</p>
            <div className="flex flex-wrap gap-2">
              {section.features.map((feature) => (
                <span key={feature} className="px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded">
                  {feature}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {/* Important Settings */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-3">⚠️ Important Settings</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>• Two-factor authentication is recommended for admin accounts</p>
          <p>• API keys should be rotated every 90 days</p>
          <p>• Audit logs are kept for 90 days</p>
          <p>• User permissions follow principle of least privilege</p>
        </div>
      </div>

      {/* Help Section */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-bold text-gray-900 mb-2">📚 Documentation</h3>
          <p className="text-sm text-gray-600 mb-3">Learn how to manage your system</p>
          <a href="#" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View Guides →
          </a>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <h3 className="text-lg font-bold text-gray-900 mb-2">💬 Support</h3>
          <p className="text-sm text-gray-600 mb-3">Need help? Contact our support team</p>
          <a href="#" className="text-green-600 hover:text-green-700 text-sm font-medium">
            Get Help →
          </a>
        </div>
      </div>
    </div>
  );
}
