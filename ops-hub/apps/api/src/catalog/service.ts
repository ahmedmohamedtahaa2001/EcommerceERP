import { randomUUID } from "node:crypto";

import {
  CatalogValidationError,
  DuplicateBarcodeError,
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
  type VariantDimensions,
  type VariantRecord,
} from "./types";

const MAX_NAME_LENGTH = 300;
const MAX_SKU_LENGTH = 100;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_CATEGORY_LENGTH = 100;
const MAX_BRAND_LENGTH = 100;
const MAX_TAGS = 30;
const MAX_TAG_LENGTH = 50;
const BARCODE_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const DEFAULT_CURRENCY = "EGP";
const BARCODE_CONSTRAINT = "variants_tenant_barcode_key";

function optionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new CatalogValidationError(`${field} must be a string or null.`);
  }
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > maxLength) {
    throw new CatalogValidationError(
      `${field} must be at most ${maxLength} characters.`,
    );
  }
  return trimmed;
}

function requireTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((t) => typeof t !== "string")) {
    throw new CatalogValidationError("tags must be an array of strings.");
  }
  const trimmed = value.map((t) => t.trim());
  if (trimmed.some((t) => t === "")) {
    throw new CatalogValidationError("tags cannot be empty.");
  }
  const tags = [...new Set(trimmed)];
  if (tags.length > MAX_TAGS) {
    throw new CatalogValidationError(
      `tags supports at most ${MAX_TAGS} entries.`,
    );
  }
  if (tags.some((t) => t.length > MAX_TAG_LENGTH)) {
    throw new CatalogValidationError(
      `each tag must be at most ${MAX_TAG_LENGTH} characters.`,
    );
  }
  return tags;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new CatalogValidationError(`${field} must be true or false.`);
  }
  return value;
}

function optionalBarcode(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new CatalogValidationError("barcode must be a string or null.");
  }
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!BARCODE_PATTERN.test(trimmed)) {
    throw new CatalogValidationError(
      "barcode must be 1-64 letters, digits or hyphens.",
    );
  }
  return trimmed;
}

function optionalNonNegativeInt(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new CatalogValidationError(
      `${field} must be a non-negative integer or null.`,
    );
  }
  return value;
}

function requireCurrency(value: unknown): string {
  if (typeof value !== "string" || !CURRENCY_PATTERN.test(value)) {
    throw new CatalogValidationError(
      "currency must be a three-letter uppercase code, such as EGP.",
    );
  }
  return value;
}

function requireDimensions(value: unknown): VariantDimensions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CatalogValidationError("dimensions must be an object.");
  }
  const dims: VariantDimensions = {};
  for (const key of ["lengthCm", "widthCm", "heightCm"] as const) {
    const entry = (value as Record<string, unknown>)[key];
    if (entry === undefined) continue;
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0) {
      throw new CatalogValidationError(`${key} must be a non-negative number.`);
    }
    dims[key] = entry;
  }
  return dims;
}

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
      category:
        request.category !== undefined
          ? optionalText(request.category, "category", MAX_CATEGORY_LENGTH)
          : null,
      brand:
        request.brand !== undefined
          ? optionalText(request.brand, "brand", MAX_BRAND_LENGTH)
          : null,
      tags: request.tags !== undefined ? requireTags(request.tags) : [],
      isHazardous:
        request.isHazardous !== undefined
          ? requireBoolean(request.isHazardous, "isHazardous")
          : false,
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
    if (request.category !== undefined) {
      fields.category = optionalText(
        request.category,
        "category",
        MAX_CATEGORY_LENGTH,
      );
    }
    if (request.brand !== undefined) {
      fields.brand = optionalText(request.brand, "brand", MAX_BRAND_LENGTH);
    }
    if (request.tags !== undefined) {
      fields.tags = requireTags(request.tags);
    }
    if (request.isHazardous !== undefined) {
      fields.isHazardous = requireBoolean(request.isHazardous, "isHazardous");
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
      barcode:
        request.barcode !== undefined ? optionalBarcode(request.barcode) : null,
      weightGrams:
        request.weightGrams !== undefined
          ? optionalNonNegativeInt(request.weightGrams, "weightGrams")
          : null,
      dimensions:
        request.dimensions !== undefined
          ? requireDimensions(request.dimensions)
          : {},
      priceMinor:
        request.priceMinor !== undefined
          ? optionalNonNegativeInt(request.priceMinor, "priceMinor")
          : null,
      currency:
        request.currency !== undefined
          ? requireCurrency(request.currency)
          : DEFAULT_CURRENCY,
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
        if (uniqueConstraint(error) === BARCODE_CONSTRAINT && record.barcode) {
          throw new DuplicateBarcodeError(record.barcode);
        }
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
    if (request.barcode !== undefined) {
      fields.barcode = optionalBarcode(request.barcode);
    }
    if (request.weightGrams !== undefined) {
      fields.weightGrams = optionalNonNegativeInt(
        request.weightGrams,
        "weightGrams",
      );
    }
    if (request.dimensions !== undefined) {
      fields.dimensions = requireDimensions(request.dimensions);
    }
    if (request.priceMinor !== undefined) {
      fields.priceMinor = optionalNonNegativeInt(
        request.priceMinor,
        "priceMinor",
      );
    }
    if (request.currency !== undefined) {
      fields.currency = requireCurrency(request.currency);
    }
    if (request.attributes !== undefined) {
      fields.attributes = requireStringRecord(request.attributes, "attributes");
    }
    if (request.images !== undefined) {
      fields.images = requireStringArray(request.images, "images");
    }

    let updated: VariantRecord | null;
    try {
      updated = await this.deps.variants.update(
        tenantId,
        id,
        fields,
        this.deps.clock.now(),
      );
    } catch (error) {
      if (
        isUniqueViolation(error) &&
        uniqueConstraint(error) === BARCODE_CONSTRAINT
      ) {
        throw new DuplicateBarcodeError(fields.barcode ?? "");
      }
      throw error;
    }
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

function uniqueConstraint(error: unknown): string | undefined {
  return (error as { constraint?: string }).constraint;
}
