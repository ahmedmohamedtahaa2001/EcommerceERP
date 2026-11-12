"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface BinLocation {
  id: string;
  code: string;
  zone: string | null;
  aisle: string | null;
  rack: string | null;
  shelf: string | null;
  bin: string | null;
  location_type: string;
  capacity: number | null;
  is_pickable: boolean;
  is_active: boolean;
}

const emptyForm = {
  code: "",
  zone: "",
  aisle: "",
  rack: "",
  shelf: "",
  bin: "",
  locationType: "storage",
  capacity: "",
};

export default function WarehouseBinsPage() {
  const params = useParams<{ id: string }>();
  const warehouseId = params.id;

  const [bins, setBins] = useState<BinLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchBins = async () => {
    try {
      const response = await fetch(`/api/warehouses/${warehouseId}/bins`);
      if (!response.ok) throw new Error("Failed to fetch bin locations");
      const data = await response.json();
      setBins(data.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load bin locations",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (warehouseId) fetchBins();
  }, [warehouseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/warehouses/${warehouseId}/bins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          capacity: form.capacity ? Number(form.capacity) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to create bin location");

      setForm(emptyForm);
      await fetchBins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create bin location",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (binId: string) => {
    try {
      const response = await fetch(
        `/api/warehouses/${warehouseId}/bins/${binId}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to delete bin location");
      await fetchBins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete bin location",
      );
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Warehouse bin locations</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 border rounded-lg p-4"
      >
        <input
          required
          placeholder="Code (e.g. A1-01)"
          className="border rounded px-3 py-2 col-span-2"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />
        <input
          placeholder="Zone"
          className="border rounded px-3 py-2"
          value={form.zone}
          onChange={(e) => setForm({ ...form, zone: e.target.value })}
        />
        <select
          className="border rounded px-3 py-2"
          value={form.locationType}
          onChange={(e) => setForm({ ...form, locationType: e.target.value })}
        >
          <option value="storage">Storage</option>
          <option value="pick_face">Pick face</option>
          <option value="bulk">Bulk</option>
          <option value="staging">Staging</option>
          <option value="returns">Returns</option>
        </select>
        <input
          placeholder="Aisle"
          className="border rounded px-3 py-2"
          value={form.aisle}
          onChange={(e) => setForm({ ...form, aisle: e.target.value })}
        />
        <input
          placeholder="Rack"
          className="border rounded px-3 py-2"
          value={form.rack}
          onChange={(e) => setForm({ ...form, rack: e.target.value })}
        />
        <input
          placeholder="Shelf"
          className="border rounded px-3 py-2"
          value={form.shelf}
          onChange={(e) => setForm({ ...form, shelf: e.target.value })}
        />
        <input
          placeholder="Bin"
          className="border rounded px-3 py-2"
          value={form.bin}
          onChange={(e) => setForm({ ...form, bin: e.target.value })}
        />
        <input
          type="number"
          min={0}
          placeholder="Capacity (units, optional)"
          className="border rounded px-3 py-2"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 col-span-2 md:col-span-1"
        >
          {submitting ? "Adding..." : "Add bin location"}
        </button>
      </form>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Code</th>
                <th className="px-6 py-3 text-left font-semibold">Zone</th>
                <th className="px-6 py-3 text-left font-semibold">Type</th>
                <th className="px-6 py-3 text-left font-semibold">Capacity</th>
                <th className="px-6 py-3 text-left font-semibold">Pickable</th>
                <th className="px-6 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bins.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No bin locations yet. Add one above.
                  </td>
                </tr>
              ) : (
                bins.map((bin) => (
                  <tr key={bin.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold">{bin.code}</td>
                    <td className="px-6 py-4">{bin.zone || "-"}</td>
                    <td className="px-6 py-4">{bin.location_type}</td>
                    <td className="px-6 py-4">{bin.capacity ?? "Unlimited"}</td>
                    <td className="px-6 py-4">
                      {bin.is_pickable ? "Yes" : "No"}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        className="text-red-600 hover:text-red-800"
                        onClick={() => handleDelete(bin.id)}
                      >
                        Delete
                      </button>
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
