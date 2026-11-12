export interface ProductPricing {
  retail_price: number;
  cost?: number;
  currency?: string;
}

export interface Product {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  brand: string | null;
  barcode: string | null;
  weight: number | null;
  tags: string[];
  is_active: boolean;
  pricing: ProductPricing;
  created_at: string;
  updated_at: string;
  inventory?: { quantity_available: number; warehouse_id?: string }[];
}

export interface ProductFormValues {
  name: string;
  sku: string;
  category: string;
  subcategory: string;
  brand: string;
  description: string;
  price: string;
  cost: string;
  barcode: string;
  weight: string;
  tags: string;
  is_active: boolean;
}

export const EMPTY_FORM_VALUES: ProductFormValues = {
  name: "",
  sku: "",
  category: "",
  subcategory: "",
  brand: "",
  description: "",
  price: "",
  cost: "",
  barcode: "",
  weight: "",
  tags: "",
  is_active: true,
};

export function productToFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku,
    category: product.category,
    subcategory: product.subcategory || "",
    brand: product.brand || "",
    description: product.description || "",
    price: String(product.pricing?.retail_price ?? ""),
    cost:
      product.pricing?.cost !== undefined ? String(product.pricing.cost) : "",
    barcode: product.barcode || "",
    weight:
      product.weight !== null && product.weight !== undefined
        ? String(product.weight)
        : "",
    tags: (product.tags || []).join(", "),
    is_active: product.is_active,
  };
}

export function totalStock(product: Product): number {
  return (product.inventory || []).reduce(
    (sum, row) => sum + (row.quantity_available || 0),
    0,
  );
}
