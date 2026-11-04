'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type ImportType = 'products' | 'customers' | 'orders';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>('products');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError('');

    // Parse CSV for preview
    const text = await selectedFile.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, idx) => {
        obj[header] = values[idx] || '';
      });
      return obj;
    });

    setPreview(data);
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());

      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((header, idx) => {
          obj[header] = values[idx] || '';
        });
        return obj;
      });

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      if (importType === 'products') {
        for (const row of data) {
          try {
            if (!row.sku || !row.name || !row.price) {
              failed++;
              errors.push(`Row with SKU ${row.sku}: Missing required fields`);
              continue;
            }

            const { error: insertError } = await supabase
              .from('products')
              .insert([
                {
                  sku: row.sku,
                  name: row.name,
                  description: row.description || '',
                  price: parseFloat(row.price),
                  cost: row.cost ? parseFloat(row.cost) : 0,
                  company_id: '11111111-1111-1111-1111-111111111111',
                },
              ]);

            if (insertError) {
              failed++;
              errors.push(`Row ${row.sku}: ${insertError.message}`);
            } else {
              success++;
            }
          } catch (err: any) {
            failed++;
            errors.push(`Row ${row.sku}: ${err.message}`);
          }
        }
      } else if (importType === 'customers') {
        for (const row of data) {
          try {
            if (!row.name || !row.email) {
              failed++;
              errors.push(`Row with email ${row.email}: Missing required fields`);
              continue;
            }

            const { error: insertError } = await supabase
              .from('customers')
              .insert([
                {
                  name: row.name,
                  email: row.email,
                  phone: row.phone || '',
                  city: row.city || '',
                  country: row.country || '',
                  company_id: '11111111-1111-1111-1111-111111111111',
                },
              ]);

            if (insertError) {
              failed++;
              errors.push(`Row ${row.name}: ${insertError.message}`);
            } else {
              success++;
            }
          } catch (err: any) {
            failed++;
            errors.push(`Row ${row.name}: ${err.message}`);
          }
        }
      }

      setResult({ success, failed, errors: errors.slice(0, 5) });
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    let csv = '';
    if (importType === 'products') {
      csv = 'sku,name,price,cost,description\nPROD-001,Laptop,999.99,500,High performance laptop\nPROD-002,Mouse,29.99,10,Wireless mouse';
    } else if (importType === 'customers') {
      csv = 'name,email,phone,city,country\nJohn Doe,john@example.com,555-0100,New York,USA\nJane Smith,jane@example.com,555-0101,Los Angeles,USA';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType}-template.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Bulk Import</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Import Type Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Select Import Type</h2>
            <div className="space-y-2">
              {(['products', 'customers', 'orders'] as const).map(type => (
                <label key={type} className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition" style={{
                  borderColor: importType === type ? '#2563eb' : '#e5e7eb',
                  backgroundColor: importType === type ? '#eff6ff' : 'white'
                }}>
                  <input
                    type="radio"
                    name="importType"
                    value={type}
                    checked={importType === type}
                    onChange={(e) => {
                      setImportType(e.target.value as ImportType);
                      setPreview([]);
                      setResult(null);
                    }}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{type}</p>
                    <p className="text-sm text-gray-600">
                      {type === 'products' && 'Import bulk products with SKU, name, price, cost'}
                      {type === 'customers' && 'Import bulk customers with contact information'}
                      {type === 'orders' && 'Import bulk orders (requires existing customers)'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Upload CSV File</h2>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csvFile"
                />
                <label htmlFor="csvFile" className="cursor-pointer">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="font-medium text-gray-900">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-600">CSV files only, max 10MB</p>
                  {file && <p className="text-blue-600 mt-2">Selected: {file.name}</p>}
                </label>
              </div>

              <button
                onClick={downloadTemplate}
                className="w-full px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium transition"
              >
                ⬇️ Download Template
              </button>
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Preview (First 5 rows)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(preview[0]).map(key => (
                        <th key={key} className="px-4 py-2 text-left font-semibold">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {Object.values(row).map((val, cidx) => (
                          <td key={cidx} className="px-4 py-2">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-lg shadow p-6 ${
              result.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <h2 className="text-lg font-bold mb-4">Import Result</h2>
              <div className="space-y-2">
                <p className={result.failed === 0 ? 'text-green-700' : 'text-yellow-700'}>
                  ✓ Successfully imported: <strong>{result.success} records</strong>
                </p>
                {result.failed > 0 && (
                  <p className="text-red-700">✗ Failed: <strong>{result.failed} records</strong></p>
                )}
                {result.errors.length > 0 && (
                  <div className="mt-3 p-3 bg-white rounded border border-red-200">
                    <p className="font-medium text-red-700 mb-2">Errors:</p>
                    <ul className="space-y-1 text-sm text-red-600">
                      {result.errors.map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Import Guide</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-900 mb-1">📋 Format</p>
                <p>CSV file with headers in first row</p>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">📊 Limits</p>
                <p>Max 10MB, 10,000 rows per import</p>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">✅ Requirements</p>
                <p>Fill all required fields</p>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">🔄 Duplicates</p>
                <p>Skipped automatically</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
          >
            {loading ? 'Importing...' : 'Import Now'}
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              💡 <strong>Tip:</strong> Download the template to see the correct format for your import type.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
