"use client";

import { useState } from "react";
import { EMPTY_FORM_VALUES, ProductFormValues } from "./types";

interface ProductFormModalProps {
  mode: "create" | "edit";
  initialValues?: ProductFormValues;
  submitting: boolean;
  onSubmit: (values: ProductFormValues) => Promise<void> | void;
  onClose: () => void;
}

export default function ProductFormModal({
  mode,
  initialValues,
  submitting,
  onSubmit,
  onClose,
}: ProductFormModalProps) {
  const [values, setValues] = useState<ProductFormValues>(
    initialValues || EMPTY_FORM_VALUES,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const update = (field: keyof ProductFormValues, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!values.name.trim() || !values.sku.trim() || !values.category.trim()) {
      setFormError("Name, SKU, and Category are required.");
      return;
    }

    const price = parseFloat(values.price);
    if (values.price === "" || isNaN(price) || price < 0) {
      setFormError("Price must be a non-negative number.");
      return;
    }

    if (
      values.cost !== "" &&
      (isNaN(parseFloat(values.cost)) || parseFloat(values.cost) < 0)
    ) {
      setFormError("Cost must be a non-negative number.");
      return;
    }

    try {
      await onSubmit(values);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save product",
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">
            {mode === "create" ? "Add Product" : "Edit Product"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {formError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={values.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">SKU *</label>
              <input
                type="text"
                value={values.sku}
                onChange={(e) => update("sku", e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Category *
              </label>
              <input
                type="text"
                value={values.category}
                onChange={(e) => update("category", e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Subcategory
              </label>
              <input
                type="text"
                value={values.subcategory}
                onChange={(e) => update("subcategory", e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Brand</label>
              <input
                type="text"
                value={values.brand}
                onChange={(e) => update("brand", e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Price *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={values.price}
                onChange={(e) => update("price", e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cost</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={values.cost}
                onChange={(e) => update("cost", e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Barcode</label>
              <input
                type="text"
                value={values.barcode}
                onChange={(e) => update("barcode", e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={values.weight}
                onChange={(e) => update("weight", e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={values.tags}
                onChange={(e) => update("tags", e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="accessory, office"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={values.description}
                onChange={(e) => update("description", e.target.value)}
                className="w-full border rounded px-3 py-2 min-h-20"
              />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={values.is_active}
                onChange={(e) => update("is_active", e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="is_active" className="text-sm font-medium">
                Active
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border hover:bg-gray-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting
                ? "Saving..."
                : mode === "create"
                  ? "Add Product"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
