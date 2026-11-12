"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProductFormModal from "@/components/products/ProductFormModal";
import ConfirmDeleteModal from "@/components/products/ConfirmDeleteModal";
import {
  Product,
  ProductFormValues,
  productToFormValues,
  totalStock,
} from "@/components/products/types";

const PAGE_SIZE = 20;

type SortBy = "name" | "sku" | "price" | "created_at";

function formValuesToPayload(values: ProductFormValues) {
  return {
    name: values.name.trim(),
    sku: values.sku.trim(),
    category: values.category.trim(),
    subcategory: values.subcategory.trim() || undefined,
    brand: values.brand.trim() || undefined,
    description: values.description.trim() || undefined,
    price: parseFloat(values.price),
    cost: values.cost !== "" ? parseFloat(values.cost) : undefined,
    barcode: values.barcode.trim() || undefined,
    weight: values.weight !== "" ? parseFloat(values.weight) : undefined,
    tags: values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    is_active: values.is_active,
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, category, sortBy, sortOrder]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy,
        sortOrder,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (category) params.set("category", category);

      const response = await fetch(`/api/products?${params.toString()}`);
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to fetch products");

      setProducts(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, debouncedSearch, category]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const sortIndicator = (field: SortBy) =>
    sortBy === field ? (sortOrder === "asc" ? " ▲" : " ▼") : "";

  const openCreateModal = () => {
    setEditingProduct(null);
    setModalMode("create");
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingProduct(null);
  };

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreate = async (values: ProductFormValues) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValuesToPayload(values)),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to create product");

      closeModal();
      showMessage("Product created successfully.");
      await fetchProducts();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values: ProductFormValues) => {
    if (!editingProduct) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValuesToPayload(values)),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to update product");

      closeModal();
      showMessage("Product updated successfully.");
      await fetchProducts();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/products/${deletingProduct.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to delete product");

      setDeletingProduct(null);
      showMessage("Product deleted successfully.");
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
      setDeletingProduct(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Product
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, barcode..."
          className="border rounded px-3 py-2 flex-1 min-w-[240px]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th
                    className="px-6 py-3 text-left font-semibold cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                  >
                    Name{sortIndicator("name")}
                  </th>
                  <th
                    className="px-6 py-3 text-left font-semibold cursor-pointer select-none"
                    onClick={() => handleSort("sku")}
                  >
                    SKU{sortIndicator("sku")}
                  </th>
                  <th
                    className="px-6 py-3 text-left font-semibold cursor-pointer select-none"
                    onClick={() => handleSort("price")}
                  >
                    Price{sortIndicator("price")}
                  </th>
                  <th className="px-6 py-3 text-left font-semibold">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left font-semibold">Stock</th>
                  <th className="px-6 py-3 text-left font-semibold">Status</th>
                  <th
                    className="px-6 py-3 text-left font-semibold cursor-pointer select-none"
                    onClick={() => handleSort("created_at")}
                  >
                    Created{sortIndicator("created_at")}
                  </th>
                  <th className="px-6 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No products found
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4">{product.name}</td>
                      <td className="px-6 py-4">{product.sku}</td>
                      <td className="px-6 py-4">
                        ${(product.pricing?.retail_price ?? 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">{product.category || "-"}</td>
                      <td className="px-6 py-4">{totalStock(product)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            product.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {new Date(product.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(product)}
                          className="text-blue-600 hover:text-blue-800 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingProduct(product)}
                          className="text-red-600 hover:text-red-800"
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

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600">
              {total} product{total === 1 ? "" : "s"} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                disabled={page + 1 >= totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {modalMode && (
        <ProductFormModal
          mode={modalMode}
          initialValues={
            editingProduct ? productToFormValues(editingProduct) : undefined
          }
          submitting={submitting}
          onSubmit={modalMode === "create" ? handleCreate : handleUpdate}
          onClose={closeModal}
        />
      )}

      {deletingProduct && (
        <ConfirmDeleteModal
          productName={deletingProduct.name}
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeletingProduct(null)}
        />
      )}
    </div>
  );
}
