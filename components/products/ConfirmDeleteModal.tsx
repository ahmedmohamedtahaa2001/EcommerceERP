"use client";

interface ConfirmDeleteModalProps {
  productName: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({
  productName,
  deleting,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Delete Product</h2>
        </div>
        <div className="px-6 py-4 text-sm text-gray-700 space-y-2">
          <p>
            Are you sure you want to delete{" "}
            <span className="font-medium">{productName}</span>?
          </p>
          <p className="text-red-600">
            This will also permanently delete this product&apos;s inventory
            records across all warehouses.
          </p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded border hover:bg-gray-50"
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
