export const PRODUCT_KINDS = ["simple", "bundle"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface VariantDimensions {
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface ProductRecord {
  id: string;
  tenantId: string;
  kind: ProductKind;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  category: string | null;
  brand: string | null;
  tags: readonly string[];
  isHazardous: boolean;
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
  barcode: string | null;
  weightGrams: number | null;
  dimensions: VariantDimensions;
  priceMinor: number | null;
  currency: string;
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
  category?: string | null;
  brand?: string | null;
  tags?: readonly string[];
  isHazardous?: boolean;
  images?: readonly string[];
  status?: ProductStatus;
}

export interface UpdateProductRequest {
  nameAr?: string;
  nameEn?: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  category?: string | null;
  brand?: string | null;
  tags?: readonly string[];
  isHazardous?: boolean;
  images?: readonly string[];
  status?: ProductStatus;
}

export interface CreateVariantRequest {
  productId: string;
  sku: string;
  barcode?: string | null;
  weightGrams?: number | null;
  dimensions?: VariantDimensions;
  priceMinor?: number | null;
  currency?: string;
  attributes?: Record<string, string>;
  images?: readonly string[];
}

/** `sku` is intentionally excluded: it is immutable once created. */
export interface UpdateVariantRequest {
  barcode?: string | null;
  weightGrams?: number | null;
  dimensions?: VariantDimensions;
  priceMinor?: number | null;
  currency?: string;
  attributes?: Record<string, string>;
  images?: readonly string[];
}

export interface ProductStore {
  create(record: ProductRecord): Promise<void>;
  getById(tenantId: string, id: string): Promise<ProductRecord | null>;
  list(
    tenantId: string,
    filter?: {
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<ProductRecord[]>;
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
        | "category"
        | "brand"
        | "tags"
        | "isHazardous"
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
    fields: Partial<
      Pick<
        VariantRecord,
        | "barcode"
        | "weightGrams"
        | "dimensions"
        | "priceMinor"
        | "currency"
        | "attributes"
        | "images"
      >
    >,
    updatedAt: Date,
  ): Promise<VariantRecord | null>;
}

export interface CatalogServiceDeps {
  products: ProductStore;
  variants: VariantStore;
  clock: { now(): Date };
}
