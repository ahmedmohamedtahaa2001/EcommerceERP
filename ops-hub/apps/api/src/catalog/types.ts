export const PRODUCT_KINDS = ["simple", "bundle"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface ProductRecord {
  id: string;
  tenantId: string;
  kind: ProductKind;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  images: readonly string[];
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
  images: readonly string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductRequest {
  kind?: ProductKind;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  images?: readonly string[];
  status?: ProductStatus;
}

export interface UpdateProductRequest {
  nameAr?: string;
  nameEn?: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  images?: readonly string[];
  status?: ProductStatus;
}

export interface CreateVariantRequest {
  productId: string;
  sku: string;
  attributes?: Record<string, string>;
  images?: readonly string[];
}

/** `sku` is intentionally excluded: it is immutable once created. */
export interface UpdateVariantRequest {
  attributes?: Record<string, string>;
  images?: readonly string[];
}

export interface ProductStore {
  create(record: ProductRecord): Promise<void>;
  getById(tenantId: string, id: string): Promise<ProductRecord | null>;
  list(tenantId: string): Promise<ProductRecord[]>;
  update(
    tenantId: string,
    id: string,
    fields: Partial<
      Pick<
        ProductRecord,
        | "nameAr"
        | "nameEn"
        | "descriptionAr"
        | "descriptionEn"
        | "images"
        | "status"
      >
    >,
    updatedAt: Date,
  ): Promise<ProductRecord | null>;
}

export interface VariantStore {
  create(record: VariantRecord): Promise<void>;
  getById(tenantId: string, id: string): Promise<VariantRecord | null>;
  getBySku(tenantId: string, sku: string): Promise<VariantRecord | null>;
  listByProduct(tenantId: string, productId: string): Promise<VariantRecord[]>;
  update(
    tenantId: string,
    id: string,
    fields: Partial<Pick<VariantRecord, "attributes" | "images">>,
    updatedAt: Date,
  ): Promise<VariantRecord | null>;
}

export interface CatalogServiceDeps {
  products: ProductStore;
  variants: VariantStore;
  clock: { now(): Date };
}
