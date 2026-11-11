import { randomUUID } from "node:crypto";

import {
  BundleComponentError,
  DuplicateSkuError,
  InvalidCatalogInputError,
  ProductHasStockError,
  ProductNotFoundError,
  SkuImmutableError,
  VariantNotFoundError,
} from "./errors";
import type {
  BundleComponentInput,
  BundleComponentRecord,
  CatalogServiceDeps,
  CreateProductInput,
  CreateVariantInput,
  ProductKind,
  ProductRecord,
  ProductStatus,
  UpdateProductInput,
  UpdateVariantInput,
  VariantRecord,
} from "./types";

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_IMAGES = 10;
const MAX_SKU_LENGTH = 64;
const SKU_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const MAX_ATTRIBUTES = 32;
const MAX_ATTRIBUTE_KEY_LENGTH = 64;
const MAX_ATTRIBUTE_VALUE_LENGTH = 256;
const MAX_LIST_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 50;

function validateName(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new InvalidCatalogInputError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_NAME_LENGTH) {
    throw new InvalidCatalogInputError(
      `${field} must be 1-${MAX_NAME_LENGTH} characters.`,
    );
  }
  return trimmed;
}

function validateDescription(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new InvalidCatalogInputError(`${field} must be a string or null.`);
  }
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new InvalidCatalogInputError(
      `${field} must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
    );
  }
  return trimmed;
}

function validateImages(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new InvalidCatalogInputError("images must be an array of URLs.");
  }
  if (value.length > MAX_IMAGES) {
    throw new InvalidCatalogInputError(
      `images supports at most ${MAX_IMAGES} entries.`,
    );
  }
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      throw new InvalidCatalogInputError("images must be an array of URLs.");
    }
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new InvalidCatalogInputError(`invalid image URL: ${entry}`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new InvalidCatalogInputError(`invalid image URL: ${entry}`);
    }
    result.push(entry);
  }
  return result;
}

function validateKind(value: unknown): ProductKind {
  if (value === undefined || value === null) return "simple";
  if (value !== "simple" && value !== "bundle") {
    throw new InvalidCatalogInputError("kind must be 'simple' or 'bundle'.");
  }
  return value;
}

function validateStatus(value: unknown): ProductStatus {
  if (value === undefined || value === null) return "draft";
  if (value !== "draft" && value !== "active" && value !== "archived") {
    throw new InvalidCatalogInputError(
      "status must be 'draft', 'active', or 'archived'.",
    );
  }
  return value;
}

function validateSku(value: unknown): string {
  if (typeof value !== "string") {
    throw new InvalidCatalogInputError("sku must be a string.");
  }
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_SKU_LENGTH || !SKU_PATTERN.test(trimmed)) {
    throw new InvalidCatalogInputError(
      `sku must match ${SKU_PATTERN.source} (max ${MAX_SKU_LENGTH} chars).`,
    );
  }
  return trimmed;
}

function validateAttributes(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidCatalogInputError("attributes must be an object.");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_ATTRIBUTES) {
    throw new InvalidCatalogInputError(
      `attributes supports at most ${MAX_ATTRIBUTES} entries.`,
    );
  }
  const result: Record<string, string> = {};
  for (const [key, val] of entries) {
    if (key.length === 0 || key.length > MAX_ATTRIBUTE_KEY_LENGTH) {
      throw new InvalidCatalogInputError("invalid attribute key.");
    }
    if (typeof val !== "string" || val.length > MAX_ATTRIBUTE_VALUE_LENGTH) {
      throw new InvalidCatalogInputError(
        `attribute '${key}' must be a string (max ${MAX_ATTRIBUTE_VALUE_LENGTH} chars).`,
      );
    }
    result[key] = val;
  }
  return result;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23503"
  );
}

export class CatalogService {
  constructor(private readonly deps: CatalogServiceDeps) {}

  async createProduct(
    input: CreateProductInput,
    tenantId: string,
  ): Promise<ProductRecord> {
    const now = this.deps.clock.now();
    const product: ProductRecord = {
      id: randomUUID(),
      tenantId,
      kind: validateKind(input.kind),
      nameAr: validateName(input.nameAr, "nameAr"),
      nameEn: validateName(input.nameEn, "nameEn"),
      descriptionAr: validateDescription(input.descriptionAr, "descriptionAr"),
      descriptionEn: validateDescription(input.descriptionEn, "descriptionEn"),
      images: validateImages(input.images),
      status: validateStatus(input.status),
      createdAt: now,
      updatedAt: now,
    };
    await this.deps.store.createProduct(product);
    return product;
  }

  async getProduct(tenantId: string, id: string): Promise<ProductRecord | null> {
    return this.deps.store.getProduct(tenantId, id);
  }

  async listProducts(
    tenantId: string,
    limit: number | undefined,
    offset: number | undefined,
  ): Promise<ProductRecord[]> {
    const resolvedLimit = Math.min(
      Math.max(1, limit ?? DEFAULT_LIST_LIMIT),
      MAX_LIST_LIMIT,
    );
    const resolvedOffset = Math.max(0, offset ?? 0);
    return this.deps.store.listProducts(tenantId, resolvedLimit, resolvedOffset);
  }

  async updateProduct(
    tenantId: string,
    id: string,
    input: UpdateProductInput,
  ): Promise<ProductRecord> {
    const existing = await this.deps.store.getProduct(tenantId, id);
    if (!existing) throw new ProductNotFoundError();

    const updated: ProductRecord = {
      ...existing,
      nameAr:
        input.nameAr !== undefined
          ? validateName(input.nameAr, "nameAr")
          : existing.nameAr,
      nameEn:
        input.nameEn !== undefined
          ? validateName(input.nameEn, "nameEn")
          : existing.nameEn,
      descriptionAr:
        input.descriptionAr !== undefined
          ? validateDescription(input.descriptionAr, "descriptionAr")
          : existing.descriptionAr,
      descriptionEn:
        input.descriptionEn !== undefined
          ? validateDescription(input.descriptionEn, "descriptionEn")
          : existing.descriptionEn,
      images:
        input.images !== undefined
          ? validateImages(input.images)
          : existing.images,
      status:
        input.status !== undefined
          ? validateStatus(input.status)
          : existing.status,
      updatedAt: this.deps.clock.now(),
    };
    const ok = await this.deps.store.updateProduct(updated);
    if (!ok) throw new ProductNotFoundError();
    return updated;
  }

  async deleteProduct(tenantId: string, id: string): Promise<void> {
    const existing = await this.deps.store.getProduct(tenantId, id);
    if (!existing) throw new ProductNotFoundError();
    const result = await this.deps.store.deleteProduct(tenantId, id);
    if (result === null) throw new ProductNotFoundError();
    if (result === "has_stock") throw new ProductHasStockError();
  }

  async createVariant(
    tenantId: string,
    productId: string,
    input: CreateVariantInput,
  ): Promise<VariantRecord> {
    const product = await this.deps.store.getProduct(tenantId, productId);
    if (!product) throw new ProductNotFoundError();

    const now = this.deps.clock.now();
    const variant: VariantRecord = {
      id: randomUUID(),
      tenantId,
      productId,
      sku: validateSku(input.sku),
      attributes: validateAttributes(input.attributes),
      images: validateImages(input.images),
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.deps.store.createVariant(variant);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateSkuError(variant.sku);
      }
      throw error;
    }
    return variant;
  }

  async getVariant(tenantId: string, id: string): Promise<VariantRecord | null> {
    return this.deps.store.getVariant(tenantId, id);
  }

  async listVariantsByProduct(
    tenantId: string,
    productId: string,
  ): Promise<VariantRecord[]> {
    const product = await this.deps.store.getProduct(tenantId, productId);
    if (!product) throw new ProductNotFoundError();
    return this.deps.store.listVariantsByProduct(tenantId, productId);
  }

  async updateVariant(
    tenantId: string,
    id: string,
    input: UpdateVariantInput,
  ): Promise<VariantRecord> {
    const existing = await this.deps.store.getVariant(tenantId, id);
    if (!existing) throw new VariantNotFoundError();

    const sku =
      input.sku !== undefined
        ? validateSku(input.sku)
        : existing.sku;

    if (sku !== existing.sku) {
      const hasMovement = await this.deps.store.hasStockMovements(
        tenantId,
        existing.id,
      );
      if (hasMovement) throw new SkuImmutableError();
    }

    const updated: VariantRecord = {
      ...existing,
      sku,
      attributes:
        input.attributes !== undefined
          ? validateAttributes(input.attributes)
          : existing.attributes,
      images:
        input.images !== undefined
          ? validateImages(input.images)
          : existing.images,
      updatedAt: this.deps.clock.now(),
    };

    try {
      const ok = await this.deps.store.updateVariant(updated);
      if (!ok) throw new VariantNotFoundError();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateSkuError(sku);
      }
      throw error;
    }
    return updated;
  }

  async deleteVariant(tenantId: string, id: string): Promise<void> {
    const existing = await this.deps.store.getVariant(tenantId, id);
    if (!existing) throw new VariantNotFoundError();
    const result = await this.deps.store.deleteVariant(tenantId, id);
    if (result === null) throw new VariantNotFoundError();
    if (result === "has_stock") throw new ProductHasStockError();
  }

  async replaceComponents(
    tenantId: string,
    bundleProductId: string,
    inputs: BundleComponentInput[],
  ): Promise<BundleComponentRecord[]> {
    const product = await this.deps.store.getProduct(tenantId, bundleProductId);
    if (!product) throw new ProductNotFoundError();
    if (product.kind !== "bundle") {
      throw new BundleComponentError(
        "components can only be attached to bundle products.",
      );
    }

    if (!Array.isArray(inputs)) {
      throw new BundleComponentError("components must be an array.");
    }

    const resolved: BundleComponentRecord[] = [];
    const seen = new Set<string>();
    for (const input of inputs) {
      if (
        typeof input !== "object" ||
        input === null ||
        typeof input.componentVariantId !== "string" ||
        typeof input.quantity !== "number"
      ) {
        throw new BundleComponentError(
          "each component needs componentVariantId (string) and quantity (number).",
        );
      }
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
        throw new BundleComponentError("quantity must be a positive integer.");
      }
      const variant = await this.deps.store.getVariant(
        tenantId,
        input.componentVariantId,
      );
      if (!variant) {
        throw new BundleComponentError(
          `unknown variant: ${input.componentVariantId}`,
        );
      }
      if (variant.productId === bundleProductId) {
        throw new BundleComponentError(
          "a bundle cannot contain its own variants.",
        );
      }
      if (seen.has(input.componentVariantId)) {
        throw new BundleComponentError(
          "duplicate component variant in bundle.",
        );
      }
      seen.add(input.componentVariantId);
      resolved.push({
        id: randomUUID(),
        tenantId,
        bundleProductId,
        componentVariantId: input.componentVariantId,
        quantity: input.quantity,
      });
    }

    try {
      await this.deps.store.replaceComponents(
        tenantId,
        bundleProductId,
        resolved,
      );
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BundleComponentError("unknown component variant.");
      }
      throw error;
    }
    return resolved;
  }

  async listComponents(
    tenantId: string,
    bundleProductId: string,
  ): Promise<BundleComponentRecord[]> {
    const product = await this.deps.store.getProduct(tenantId, bundleProductId);
    if (!product) throw new ProductNotFoundError();
    return this.deps.store.listComponents(tenantId, bundleProductId);
  }

  async importProducts(
    tenantId: string,
    rows: import("./types").ImportRow[],
    dryRun: boolean,
  ): Promise<import("./types").ImportReport> {
    const existing = await this.deps.store.listAllVariants(tenantId);
    const existingSkus = new Set(existing.map((v) => v.sku));
    const seenSkus = new Set<string>();

    const validRows: {
      row: number;
      sku?: string;
      attributes?: Record<string, string>;
      input: import("./types").CreateProductInput & {
        sku?: string;
        attributes?: Record<string, string>;
        images?: string[];
      };
    }[] = [];
    const errors: { row: number; reason: string }[] = [];

    for (const r of rows) {
      try {
        const nameAr = validateName(r.nameAr, "nameAr");
        const nameEn = validateName(r.nameEn, "nameEn");
        const kind = validateKind(r.kind);
        const status = validateStatus(r.status);
        const descriptionAr = validateDescription(r.descriptionAr, "descriptionAr");
        const descriptionEn = validateDescription(r.descriptionEn, "descriptionEn");
        const images = validateImages(r.images ?? []);
        const attributes = validateAttributes(r.attributes ?? {});

        let sku: string | undefined;
        if (r.sku !== undefined && r.sku !== null && String(r.sku).trim() !== "") {
          sku = validateSku(r.sku);
          if (existingSkus.has(sku) || seenSkus.has(sku)) {
            throw new DuplicateSkuError(sku);
          }
          seenSkus.add(sku);
        }

        const entry: {
          row: number;
          sku?: string;
          attributes?: Record<string, string>;
          input: import("./types").CreateProductInput & {
            sku?: string;
            attributes?: Record<string, string>;
            images?: string[];
          };
        } = {
          row: r.row,
          input: {
            nameAr,
            nameEn,
            kind,
            status,
            descriptionAr,
            descriptionEn,
            images,
          },
        };
        if (sku !== undefined) entry.sku = sku;
        if (attributes && Object.keys(attributes).length > 0) {
          entry.attributes = attributes;
        }
        validRows.push(entry);
      } catch (error) {
        errors.push({
          row: r.row,
          reason: (error as Error).message,
        });
      }
    }

    let created = 0;
    if (!dryRun) {
      for (const entry of validRows) {
        try {
          const product = await this.createProduct(entry.input, tenantId);
          if (entry.sku) {
            await this.createVariant(tenantId, product.id, {
              sku: entry.sku,
              attributes: entry.attributes ?? {},
              images: entry.input.images ?? [],
            });
          }
          created += 1;
        } catch (error) {
          errors.push({
            row: entry.row,
            reason: (error as Error).message,
          });
        }
      }
    }

    return {
      dryRun,
      total: rows.length,
      valid: validRows.length,
      created,
      errors,
    };
  }

  static parsePagination(limit: unknown, offset: unknown): {
    limit: number | undefined;
    offset: number | undefined;
  } {
    const parsedLimit =
      limit === undefined || limit === null
        ? undefined
        : Number(limit);
    const parsedOffset =
      offset === undefined || offset === null
        ? undefined
        : Number(offset);
    if (parsedLimit !== undefined && !Number.isInteger(parsedLimit)) {
      throw new InvalidCatalogInputError("limit must be an integer.");
    }
    if (parsedOffset !== undefined && !Number.isInteger(parsedOffset)) {
      throw new InvalidCatalogInputError("offset must be an integer.");
    }
    return { limit: parsedLimit, offset: parsedOffset };
  }
}
