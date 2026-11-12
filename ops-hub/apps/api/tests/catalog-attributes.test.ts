import { describe, expect, it } from "vitest";

import {
  CatalogValidationError,
  DuplicateBarcodeError,
} from "../src/catalog/errors";
import { CatalogService } from "../src/catalog/service";
import type {
  ProductRecord,
  ProductStore,
  VariantRecord,
  VariantStore,
} from "../src/catalog/types";

const tenantId = "00000000-0000-4000-8000-00000000a001";

class FakeProducts implements ProductStore {
  readonly rows: ProductRecord[] = [];
  async create(record: ProductRecord): Promise<void> {
    this.rows.push(record);
  }
  async getById(t: string, id: string) {
    return this.rows.find((r) => r.tenantId === t && r.id === id) ?? null;
  }
  async list() {
    return this.rows;
  }
  async update(
    t: string,
    id: string,
    fields: Partial<ProductRecord>,
    updatedAt: Date,
  ) {
    const row = await this.getById(t, id);
    if (!row) return null;
    Object.assign(row, fields, { updatedAt });
    return row;
  }
}

class FakeVariants implements VariantStore {
  readonly rows: VariantRecord[] = [];
  async create(record: VariantRecord): Promise<void> {
    if (
      record.barcode !== null &&
      this.rows.some(
        (r) => r.tenantId === record.tenantId && r.barcode === record.barcode,
      )
    ) {
      throw Object.assign(new Error("duplicate"), {
        code: "23505",
        constraint: "variants_tenant_barcode_key",
      });
    }
    this.rows.push(record);
  }
  async getById(t: string, id: string) {
    return this.rows.find((r) => r.tenantId === t && r.id === id) ?? null;
  }
  async getBySku(t: string, sku: string) {
    return this.rows.find((r) => r.tenantId === t && r.sku === sku) ?? null;
  }
  async listByProduct(t: string, productId: string) {
    return this.rows.filter(
      (r) => r.tenantId === t && r.productId === productId,
    );
  }
  async update(
    t: string,
    id: string,
    fields: Partial<VariantRecord>,
    updatedAt: Date,
  ) {
    const row = await this.getById(t, id);
    if (!row) return null;
    Object.assign(row, fields, { updatedAt });
    return row;
  }
}

function setup() {
  const products = new FakeProducts();
  const variants = new FakeVariants();
  const service = new CatalogService({
    products,
    variants,
    clock: { now: () => new Date("2026-11-12T10:00:00Z") },
  });
  return { service, products, variants };
}

async function productWithVariant(service: CatalogService) {
  const product = await service.createProduct(
    { nameEn: "Shirt", nameAr: "قميص" },
    tenantId,
  );
  return product;
}

describe("product attributes", () => {
  it("stores category, brand, tags and hazard flag with defaults", async () => {
    const { service } = setup();
    const product = await service.createProduct(
      { nameEn: "Shirt", nameAr: "قميص" },
      tenantId,
    );
    expect(product.category).toBeNull();
    expect(product.brand).toBeNull();
    expect(product.tags).toEqual([]);
    expect(product.isHazardous).toBe(false);
  });

  it("accepts and normalizes category, brand, tags and hazard flag", async () => {
    const { service } = setup();
    const product = await service.createProduct(
      {
        nameEn: "Shirt",
        nameAr: "قميص",
        category: "  Apparel ",
        brand: "Acme",
        tags: ["summer", " cotton ", "summer"],
        isHazardous: false,
      },
      tenantId,
    );
    expect(product.category).toBe("Apparel");
    expect(product.brand).toBe("Acme");
    expect(product.tags).toEqual(["summer", "cotton"]);
  });

  it("treats an empty category or brand as null", async () => {
    const { service } = setup();
    const product = await service.createProduct(
      { nameEn: "Shirt", nameAr: "قميص", category: "   ", brand: "" },
      tenantId,
    );
    expect(product.category).toBeNull();
    expect(product.brand).toBeNull();
  });

  it("rejects too many tags, empty tags and over-long tags", async () => {
    const { service } = setup();
    const base = { nameEn: "Shirt", nameAr: "قميص" };
    await expect(
      service.createProduct(
        { ...base, tags: Array.from({ length: 31 }, (_, i) => `t${i}`) },
        tenantId,
      ),
    ).rejects.toBeInstanceOf(CatalogValidationError);
    await expect(
      service.createProduct({ ...base, tags: ["   "] }, tenantId),
    ).rejects.toBeInstanceOf(CatalogValidationError);
    await expect(
      service.createProduct({ ...base, tags: ["x".repeat(51)] }, tenantId),
    ).rejects.toBeInstanceOf(CatalogValidationError);
  });

  it("rejects a non-boolean hazard flag", async () => {
    const { service } = setup();
    await expect(
      service.createProduct(
        {
          nameEn: "Shirt",
          nameAr: "قميص",
          isHazardous: "yes" as unknown as boolean,
        },
        tenantId,
      ),
    ).rejects.toBeInstanceOf(CatalogValidationError);
  });

  it("updates category, brand, tags and hazard flag", async () => {
    const { service } = setup();
    const product = await productWithVariant(service);
    const updated = await service.updateProduct(tenantId, product.id, {
      category: "Footwear",
      brand: null,
      tags: ["sale"],
      isHazardous: true,
    });
    expect(updated.category).toBe("Footwear");
    expect(updated.brand).toBeNull();
    expect(updated.tags).toEqual(["sale"]);
    expect(updated.isHazardous).toBe(true);
  });
});

describe("variant attributes", () => {
  it("stores price, currency, barcode, weight and dimensions", async () => {
    const { service } = setup();
    const product = await productWithVariant(service);
    const variant = await service.createVariant(
      {
        productId: product.id,
        sku: "SHIRT-M",
        barcode: "6291041500213",
        weightGrams: 250,
        dimensions: { lengthCm: 30, widthCm: 20, heightCm: 2 },
        priceMinor: 14900,
        currency: "EGP",
      },
      tenantId,
    );
    expect(variant.priceMinor).toBe(14900);
    expect(variant.currency).toBe("EGP");
    expect(variant.barcode).toBe("6291041500213");
    expect(variant.weightGrams).toBe(250);
    expect(variant.dimensions).toEqual({
      lengthCm: 30,
      widthCm: 20,
      heightCm: 2,
    });
  });

  it("defaults currency to EGP and leaves price unset", async () => {
    const { service } = setup();
    const product = await productWithVariant(service);
    const variant = await service.createVariant(
      { productId: product.id, sku: "SHIRT-S" },
      tenantId,
    );
    expect(variant.currency).toBe("EGP");
    expect(variant.priceMinor).toBeNull();
    expect(variant.barcode).toBeNull();
    expect(variant.weightGrams).toBeNull();
    expect(variant.dimensions).toEqual({});
  });

  it.each([
    ["negative price", { priceMinor: -1 }],
    ["fractional price", { priceMinor: 10.5 }],
    ["lowercase currency", { currency: "egp" }],
    ["two-letter currency", { currency: "EG" }],
    ["negative weight", { weightGrams: -5 }],
    ["barcode with spaces", { barcode: "12 34" }],
    ["barcode over 64 chars", { barcode: "1".repeat(65) }],
    ["negative dimension", { dimensions: { lengthCm: -1 } }],
  ])("rejects %s", async (_label, extra) => {
    const { service } = setup();
    const product = await productWithVariant(service);
    await expect(
      service.createVariant(
        { productId: product.id, sku: "BAD-1", ...extra } as never,
        tenantId,
      ),
    ).rejects.toBeInstanceOf(CatalogValidationError);
  });

  it("rejects a barcode already used by another variant in the tenant", async () => {
    const { service } = setup();
    const product = await productWithVariant(service);
    await service.createVariant(
      { productId: product.id, sku: "A-1", barcode: "111" },
      tenantId,
    );
    await expect(
      service.createVariant(
        { productId: product.id, sku: "A-2", barcode: "111" },
        tenantId,
      ),
    ).rejects.toBeInstanceOf(DuplicateBarcodeError);
  });

  it("updates price (including clearing it) and currency, but never the SKU", async () => {
    const { service } = setup();
    const product = await productWithVariant(service);
    const variant = await service.createVariant(
      { productId: product.id, sku: "P-1", priceMinor: 5000 },
      tenantId,
    );
    const repriced = await service.updateVariant(tenantId, variant.id, {
      priceMinor: 6000,
      currency: "USD",
    });
    expect(repriced.priceMinor).toBe(6000);
    expect(repriced.currency).toBe("USD");

    const cleared = await service.updateVariant(tenantId, variant.id, {
      priceMinor: null,
    });
    expect(cleared.priceMinor).toBeNull();
    expect(cleared.sku).toBe("P-1");
  });
});
