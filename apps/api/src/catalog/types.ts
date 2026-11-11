import type { Clock } from "@ops-hub/shared";

export type ProductKind = "simple" | "bundle";
export type ProductStatus = "draft" | "active" | "archived";

export interface ProductRecord {
  id: string;
  tenantId: string;
  kind: ProductKind;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  images: string[];
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface VariantRecord {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  attributes: Record<string, string>;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BundleComponentRecord {
  id: string;
  tenantId: string;
  bundleProductId: string;
  componentVariantId: string;
  quantity: number;
}

export interface CreateProductInput {
  kind?: ProductKind;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  images?: string[];
  status?: ProductStatus;
}

export interface UpdateProductInput {
  nameAr?: string;
  nameEn?: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  images?: string[];
  status?: ProductStatus;
}

export interface CreateVariantInput {
  sku: string;
  attributes?: Record<string, string>;
  images?: string[];
}

export interface UpdateVariantInput {
  sku?: string;
  attributes?: Record<string, string>;
  images?: string[];
}

export interface BundleComponentInput {
  componentVariantId: string;
  quantity: number;
}

export interface CatalogStore {
  createProduct(product: ProductRecord): Promise<void>;
  getProduct(tenantId: string, id: string): Promise<ProductRecord | null>;
  listProducts(
    tenantId: string,
    limit: number,
    offset: number,
  ): Promise<ProductRecord[]>;
  updateProduct(product: ProductRecord): Promise<boolean>;
  deleteProduct(
    tenantId: string,
    id: string,
  ): Promise<"deleted" | "has_stock" | null>;

  createVariant(variant: VariantRecord): Promise<void>;
  getVariant(tenantId: string, id: string): Promise<VariantRecord | null>;
  getVariantBySku(tenantId: string, sku: string): Promise<VariantRecord | null>;
  listVariantsByProduct(
    tenantId: string,
    productId: string,
  ): Promise<VariantRecord[]>;
  listAllVariants(tenantId: string): Promise<VariantRecord[]>;
  updateVariant(variant: VariantRecord): Promise<boolean>;
  deleteVariant(
    tenantId: string,
    id: string,
  ): Promise<"deleted" | "has_stock" | null>;
  hasStockMovements(tenantId: string, variantId: string): Promise<boolean>;

  replaceComponents(
    tenantId: string,
    bundleProductId: string,
    components: BundleComponentRecord[],
  ): Promise<void>;
  listComponents(
    tenantId: string,
    bundleProductId: string,
  ): Promise<BundleComponentRecord[]>;
}

export interface CatalogServiceDeps {
  store: CatalogStore;
  clock: Clock;
}

export interface ParsedImport {
  rows: ImportRow[];
  parseError?: string;
}

export interface ImportRow {
  row: number;
  nameAr: string;
  nameEn: string;
  kind?: ProductKind;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  status?: ProductStatus;
  sku?: string;
  attributes?: Record<string, string>;
  images?: string[];
}

export interface ImportReport {
  dryRun: boolean;
  total: number;
  valid: number;
  created: number;
  errors: { row: number; reason: string }[];
}