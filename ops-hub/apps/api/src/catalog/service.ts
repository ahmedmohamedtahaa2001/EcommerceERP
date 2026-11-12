import { randomUUID } from "node:crypto";

import {
  CatalogValidationError,
  DuplicateSkuError,
  ProductNotFoundError,
  VariantNotFoundError,
} from "./errors";
import {
  PRODUCT_KINDS,
  PRODUCT_STATUSES,
  type CatalogServiceDeps,
  type CreateProductRequest,
  type CreateVariantRequest,
  type ProductRecord,
  type UpdateProductRequest,
  type UpdateVariantRequest,
  type VariantRecord,
} from "./types";

const MAX_NAME_LENGTH = 300;
const MAX_SKU_LENGTH = 100;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function requireName(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CatalogValidationError(`${field} is required.`);
  }
  if (value.length > MAX_NAME_LENGTH) {
    throw new CatalogValidationError(
      `${field} must be at most ${MAX_NAME_LENGTH} characters.`,
    );
  }
  return value;
}

function requireStringRecord(
  value: unknown,
  field: string,
): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CatalogValidationError(`${field} must be an object of strings.`);
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (typeof entry !== "string") {
      throw new CatalogValidationError(
        `${field} must be an object of strings.`,
      );
    }
  }
  return value as Record<string, string>;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new CatalogValidationError(`${field} must be an array of strings.`);
  }
  return value as string[];
}

export class CatalogService {
  constructor(private readonly deps: CatalogServiceDeps) {}

  async createProduct(
    request: CreateProductRequest,
    tenantId: string,
  ): Promise<ProductRecord> {
    const nameEn = requireName(request.nameEn, "nameEn");
    const nameAr = requireName(request.nameAr, "nameAr");

    if (
      request.kind !== undefined &&
      !(PRODUCT_KINDS as readonly string[]).includes(request.kind)
    ) {
      throw new CatalogValidationError(
        `kind must be one of: ${PRODUCT_KINDS.join(", ")}.`,
      );
    }
    if (
      request.status !== undefined &&
      !(PRODUCT_STATUSES as readonly string[]).includes(request.status)
    ) {
      throw new CatalogValidationError(
        `status must be one of: ${PRODUCT_STATUSES.join(", ")}.`,
      );
    }
    const images =
      request.images !== undefined
        ? requireStringArray(request.images, "images")
        : [];

    const now = this.deps.clock.now();
    const record: ProductRecord = {
      id: randomUUID(),
      tenantId,
      kind: request.kind ?? "simple",
      nameAr,
      nameEn,
      descriptionAr: request.descriptionAr ?? null,
      descriptionEn: request.descriptionEn ?? null,
      images,
      status: request.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    };

    await this.deps.products.create(record);
    return record;
  }

  async getProduct(tenantId: string, id: string): Promise<ProductRecord> {
    const product = await this.deps.products.getById(tenantId, id);
    if (!product) {
      throw new ProductNotFoundError();
    }
    return product;
  }

  async listProducts(
    tenantId: string,
    filter: {
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    } = {},
  ): Promise<ProductRecord[]> {
    return this.deps.products.list(tenantId, filter);
  }

  async updateProduct(
    tenantId: string,
    id: string,
    request: UpdateProductRequest,
  ): Promise<ProductRecord> {
    const existing = await this.deps.products.getById(tenantId, id);
    if (!existing) {
      throw new ProductNotFoundError();
    }

    const fields: Parameters<typeof this.deps.products.update>[2] = {};
    if (request.nameEn !== undefined) {
      fields.nameEn = requireName(request.nameEn, "nameEn");
    }
    if (request.nameAr !== undefined) {
      fields.nameAr = requireName(request.nameAr, "nameAr");
    }
    if (request.descriptionEn !== undefined) {
      fields.descriptionEn = request.descriptionEn;
    }
    if (request.descriptionAr !== undefined) {
      fields.descriptionAr = request.descriptionAr;
    }
    if (request.images !== undefined) {
      fields.images = requireStringArray(request.images, "images");
    }
    if (request.status !== undefined) {
      if (!(PRODUCT_STATUSES as readonly string[]).includes(request.status)) {
        throw new CatalogValidationError(
          `status must be one of: ${PRODUCT_STATUSES.join(", ")}.`,
        );
      }
      fields.status = request.status;
    }

    const updated = await this.deps.products.update(
      tenantId,
      id,
      fields,
      this.deps.clock.now(),
    );
    if (!updated) {
      throw new ProductNotFoundError();
    }
    return updated;
  }

  async createVariant(
    request: CreateVariantRequest,
    tenantId: string,
  ): Promise<VariantRecord> {
    const product = await this.deps.products.getById(
      tenantId,
      request.productId,
    );
    if (!product) {
      throw new ProductNotFoundError();
    }

    const sku = request.sku.trim();
    if (sku === "" || sku.length > MAX_SKU_LENGTH || !SKU_PATTERN.test(sku)) {
      throw new CatalogValidationError(
        "sku must be 1-100 characters, starting alphanumeric, using only letters, digits, '.', '_' and '-'.",
      );
    }
    const attributes =
      request.attributes !== undefined
        ? requireStringRecord(request.attributes, "attributes")
        : {};
    const images =
      request.images !== undefined
        ? requireStringArray(request.images, "images")
        : [];

    const existing = await this.deps.variants.getBySku(tenantId, sku);
    if (existing) {
      throw new DuplicateSkuError(sku);
    }

    const now = this.deps.clock.now();
    const record: VariantRecord = {
      id: randomUUID(),
      tenantId,
      productId: request.productId,
      sku,
      attributes,
      images,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.deps.variants.create(record);
    } catch (error) {
      // Guards the race between the pre-check above and the unique index.
      if (isUniqueViolation(error)) {
        throw new DuplicateSkuError(sku);
      }
      throw error;
    }
    return record;
  }

  async getVariant(tenantId: string, id: string): Promise<VariantRecord> {
    const variant = await this.deps.variants.getById(tenantId, id);
    if (!variant) {
      throw new VariantNotFoundError();
    }
    return variant;
  }

  async listVariants(
    tenantId: string,
    productId: string,
  ): Promise<VariantRecord[]> {
    return this.deps.variants.listByProduct(tenantId, productId);
  }

  /** `sku` is never accepted here: it is immutable once a variant exists. */
  async updateVariant(
    tenantId: string,
    id: string,
    request: UpdateVariantRequest,
  ): Promise<VariantRecord> {
    const existing = await this.deps.variants.getById(tenantId, id);
    if (!existing) {
      throw new VariantNotFoundError();
    }

    const fields: Parameters<typeof this.deps.variants.update>[2] = {};
    if (request.attributes !== undefined) {
      fields.attributes = requireStringRecord(request.attributes, "attributes");
    }
    if (request.images !== undefined) {
      fields.images = requireStringArray(request.images, "images");
    }

    const updated = await this.deps.variants.update(
      tenantId,
      id,
      fields,
      this.deps.clock.now(),
    );
    if (!updated) {
      throw new VariantNotFoundError();
    }
    return updated;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
