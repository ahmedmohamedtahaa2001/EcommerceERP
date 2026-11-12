import { apiFetch } from "./client";

/**
 * Wire shapes for `/v1/products*` and `/v1/variants*`, matching
 * `apps/api/src/catalog/{types,routes}.ts`. Dates arrive as ISO strings.
 */

export type ProductKind = "simple" | "bundle";
export type ProductStatus = "draft" | "active" | "archived";

/** Matches `ProductRecord` in apps/api/src/catalog/types.ts. */
export interface Product {
  id: string;
  tenantId: string;
  kind: ProductKind;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  images: string[];
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

/** Matches `VariantRecord` in apps/api/src/catalog/types.ts. */
export interface Variant {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  attributes: Record<string, string>;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  kind?: ProductKind;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  images?: string[];
  status?: ProductStatus;
}

export interface UpdateProductRequest {
  nameAr?: string;
  nameEn?: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  images?: string[];
  status?: ProductStatus;
}

export interface CreateVariantRequest {
  productId: string;
  sku: string;
  attributes?: Record<string, string>;
  images?: string[];
}

/** `sku` is immutable once created (server rejects it on PATCH). */
export interface UpdateVariantRequest {
  attributes?: Record<string, string>;
  images?: string[];
}

export interface ImportRowError {
  row: number;
  reason: string;
}

/** Matches `ImportResult` in apps/api/src/catalog/import-service.ts. */
export interface ImportResult {
  totalRows: number;
  createdCount: number;
  dryRun: boolean;
  errors: ImportRowError[];
}

export interface ImportProductsRequest {
  format: "csv" | "xlsx";
  /** Raw CSV text, or base64 for xlsx. */
  content: string;
  dryRun: boolean;
}

/** `GET /v1/products` → 200. */
export function listProducts(): Promise<{ products: Product[] }> {
  return apiFetch<{ products: Product[] }>("/v1/products");
}

/** `GET /v1/products/:id` → 200. */
export function getProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/v1/products/${encodeURIComponent(id)}`);
}

/** `POST /v1/products` → 201. */
export function createProduct(body: CreateProductRequest): Promise<Product> {
  return apiFetch<Product>("/v1/products", { method: "POST", body });
}

/** `PATCH /v1/products/:id` → 200. */
export function updateProduct(
  id: string,
  body: UpdateProductRequest,
): Promise<Product> {
  return apiFetch<Product>(`/v1/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}

/** `GET /v1/products/:productId/variants` → 200. */
export function listVariants(
  productId: string,
): Promise<{ variants: Variant[] }> {
  return apiFetch<{ variants: Variant[] }>(
    `/v1/products/${encodeURIComponent(productId)}/variants`,
  );
}

/** `GET /v1/variants/:id` → 200. */
export function getVariant(id: string): Promise<Variant> {
  return apiFetch<Variant>(`/v1/variants/${encodeURIComponent(id)}`);
}

/** `POST /v1/variants` → 201. */
export function createVariant(body: CreateVariantRequest): Promise<Variant> {
  return apiFetch<Variant>("/v1/variants", { method: "POST", body });
}

/** `PATCH /v1/variants/:id` → 200. */
export function updateVariant(
  id: string,
  body: UpdateVariantRequest,
): Promise<Variant> {
  return apiFetch<Variant>(`/v1/variants/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}

/** `POST /v1/products/import` → 200 (dry-run report or import result). */
export function importProducts(
  body: ImportProductsRequest,
): Promise<ImportResult> {
  return apiFetch<ImportResult>("/v1/products/import", {
    method: "POST",
    body,
  });
}
