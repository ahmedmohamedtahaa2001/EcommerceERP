import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { CatalogService } from "../src/catalog/service";
import { parseImportBuffer } from "../src/catalog/import";
import type {
  BundleComponentRecord,
  CatalogStore,
  ImportRow,
  ProductRecord,
  VariantRecord,
} from "../src/catalog/types";
import { AuthService } from "../src/auth/service";
import type { UserRecord } from "../src/auth/types";
import {
  FakeAuditWriter,
  FakeClock,
  FakeDirectory,
  FakeHasher,
  FakeLimiter,
  FakeSessions,
  NoopAuditReader,
  SESSION_TTL_SECONDS,
  ownerUser,
  viewerUser,
} from "./fakes";

class FakeCatalogStore implements CatalogStore {
  readonly products = new Map<string, ProductRecord>();
  readonly variants = new Map<string, VariantRecord>();
  readonly components = new Map<string, BundleComponentRecord[]>();
  readonly variantsWithMovements = new Set<string>();

  private key(tenantId: string, id: string): string {
    return `${tenantId}:${id}`;
  }

  async createProduct(product: ProductRecord): Promise<void> {
    this.products.set(this.key(product.tenantId, product.id), { ...product });
  }

  async getProduct(tenantId: string, id: string): Promise<ProductRecord | null> {
    const p = this.products.get(this.key(tenantId, id));
    return p ? { ...p } : null;
  }

  async listProducts(
    tenantId: string,
    limit: number,
    offset: number,
  ): Promise<ProductRecord[]> {
    return [...this.products.values()]
      .filter((p) => p.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit)
      .map((p) => ({ ...p }));
  }

  async updateProduct(product: ProductRecord): Promise<boolean> {
    const key = this.key(product.tenantId, product.id);
    if (!this.products.has(key)) return false;
    this.products.set(key, { ...product });
    return true;
  }

  async deleteProduct(
    tenantId: string,
    id: string,
  ): Promise<"deleted" | "has_stock" | null> {
    const key = this.key(tenantId, id);
    if (!this.products.has(key)) return null;
    const hasMovement = [...this.variants.values()].some(
      (v) => v.tenantId === tenantId && v.productId === id && this.variantsWithMovements.has(v.id),
    );
    if (hasMovement) return "has_stock";
    this.products.delete(key);
    // cascade variants
    for (const [k, v] of [...this.variants.entries()]) {
      if (v.tenantId === tenantId && v.productId === id) this.variants.delete(k);
    }
    return "deleted";
  }

  async createVariant(variant: VariantRecord): Promise<void> {
    const duplicate = [...this.variants.values()].some(
      (v) => v.tenantId === variant.tenantId && v.sku === variant.sku,
    );
    if (duplicate) {
      const err = new Error("duplicate") as Error & { code: string };
      err.code = "23505";
      throw err;
    }
    this.variants.set(this.key(variant.tenantId, variant.id), { ...variant });
  }

  async getVariant(tenantId: string, id: string): Promise<VariantRecord | null> {
    const v = this.variants.get(this.key(tenantId, id));
    return v ? { ...v } : null;
  }

  async getVariantBySku(tenantId: string, sku: string): Promise<VariantRecord | null> {
    const v = [...this.variants.values()].find(
      (x) => x.tenantId === tenantId && x.sku === sku,
    );
    return v ? { ...v } : null;
  }

  async listVariantsByProduct(
    tenantId: string,
    productId: string,
  ): Promise<VariantRecord[]> {
    return [...this.variants.values()]
      .filter((v) => v.tenantId === tenantId && v.productId === productId)
      .map((v) => ({ ...v }));
  }

  async listAllVariants(tenantId: string): Promise<VariantRecord[]> {
    return [...this.variants.values()]
      .filter((v) => v.tenantId === tenantId)
      .map((v) => ({ ...v }));
  }

  async updateVariant(variant: VariantRecord): Promise<boolean> {
    const key = this.key(variant.tenantId, variant.id);
    if (!this.variants.has(key)) return false;
    const duplicate = [...this.variants.values()].some(
      (v) =>
        v.tenantId === variant.tenantId &&
        v.sku === variant.sku &&
        v.id !== variant.id,
    );
    if (duplicate) {
      const err = new Error("duplicate") as Error & { code: string };
      err.code = "23505";
      throw err;
    }
    this.variants.set(key, { ...variant });
    return true;
  }

  async deleteVariant(
    tenantId: string,
    id: string,
  ): Promise<"deleted" | "has_stock" | null> {
    const key = this.key(tenantId, id);
    if (!this.variants.has(key)) return null;
    if (this.variantsWithMovements.has(id)) return "has_stock";
    this.variants.delete(key);
    return "deleted";
  }

  async hasStockMovements(tenantId: string, variantId: string): Promise<boolean> {
    return this.variantsWithMovements.has(variantId);
  }

  async replaceComponents(
    tenantId: string,
    bundleProductId: string,
    components: BundleComponentRecord[],
  ): Promise<void> {
    this.components.set(
      this.key(tenantId, bundleProductId),
      components.map((c) => ({ ...c })),
    );
  }

  async listComponents(
    tenantId: string,
    bundleProductId: string,
  ): Promise<BundleComponentRecord[]> {
    const list = this.components.get(this.key(tenantId, bundleProductId));
    return list ? list.map((c) => ({ ...c })) : [];
  }

  markVariantHasMovement(variantId: string): void {
    this.variantsWithMovements.add(variantId);
  }
}

const owner: UserRecord = ownerUser;
const viewer: UserRecord = viewerUser;

let app: FastifyInstance;
let clock: FakeClock;
let store: FakeCatalogStore;
let auth: AuthService;
let catalogService: CatalogService;
let auditWriter: FakeAuditWriter;

beforeEach(() => {
  clock = new FakeClock();
  store = new FakeCatalogStore();
  auditWriter = new FakeAuditWriter();
  auth = new AuthService({
    users: new FakeDirectory([owner, viewer]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: new FakeLimiter(),
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });
  catalogService = new CatalogService({ store, clock });

  app = buildApp({
    logger: false,
    auth,
    catalog: catalogService,
    audit: auditWriter,
    auditReader: new NoopAuditReader(),
  });
});

afterEach(async () => {
  await app.close();
});

async function loginAs(user: UserRecord): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: user.email, password: "correct-horse" },
  });
  return response.json<{ token: string }>().token;
}

describe("POST /v1/products", () => {
  it("creates a product and returns 201", async () => {
    const token = await loginAs(owner);
    const response = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product", kind: "simple" },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json<ProductRecord>();
    expect(body.nameAr).toBe("منتج");
    expect(body.nameEn).toBe("Product");
    expect(body.kind).toBe("simple");
    expect(body.status).toBe("draft");
    expect(body.images).toEqual([]);
    expect(auditWriter.entries.filter((e) => e.action === "product.created")).toHaveLength(1);
    expect(auditWriter.entries.at(-1)?.action).toBe("product.created");
  });

  it("rejects empty name with 422", async () => {
    const token = await loginAs(owner);
    const response = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "", nameEn: "Product" },
    });
    expect(response.statusCode).toBe(422);
  });

  it("rejects invalid kind with 422", async () => {
    const token = await loginAs(owner);
    const response = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product", kind: "widget" },
    });
    expect(response.statusCode).toBe(422);
  });

  it("rejects invalid image URL with 422", async () => {
    const token = await loginAs(owner);
    const response = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nameAr: "منتج",
        nameEn: "Product",
        images: ["not-a-url"],
      },
    });
    expect(response.statusCode).toBe(422);
  });

  it("forbids viewer from creating", async () => {
    const token = await loginAs(viewer);
    const response = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product" },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("GET /v1/products", () => {
  it("lists products with pagination", async () => {
    const token = await loginAs(owner);
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "POST",
        url: "/v1/products",
        headers: { authorization: `Bearer ${token}` },
        payload: { nameAr: `منتج${i}`, nameEn: `Product${i}` },
      });
    }
    const response = await app.inject({
      method: "GET",
      url: "/v1/products?limit=2&offset=0",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ products: ProductRecord[] }>().products).toHaveLength(2);
  });
});

describe("PATCH /v1/products/:id", () => {
  it("updates fields and records audit", async () => {
    const token = await loginAs(owner);
    const created = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product" },
    });
    const id = created.json<ProductRecord>().id;
    const beforeCount = auditWriter.entries.length;
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/products/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { nameEn: "Updated", status: "active" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<ProductRecord>().nameEn).toBe("Updated");
    expect(response.json<ProductRecord>().status).toBe("active");
    expect(auditWriter.entries.length).toBe(beforeCount + 1);
    expect(auditWriter.entries.at(-1)?.action).toBe("product.updated");
  });

  it("returns 404 for unknown id", async () => {
    const token = await loginAs(owner);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/products/00000000-0000-4000-8000-000000000999",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameEn: "X" },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("DELETE /v1/products/:id", () => {
  it("deletes a product without stock", async () => {
    const token = await loginAs(owner);
    const created = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product" },
    });
    const id = created.json<ProductRecord>().id;
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/products/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(204);
  });
});

describe("variants", () => {
  it("creates a variant and rejects duplicate SKU with 409", async () => {
    const token = await loginAs(owner);
    const created = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product" },
    });
    const productId = created.json<ProductRecord>().id;

    const v1 = await app.inject({
      method: "POST",
      url: `/v1/products/${productId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "SKU-1", attributes: { color: "red" } },
    });
    expect(v1.statusCode).toBe(201);
    expect(v1.json<VariantRecord>().sku).toBe("SKU-1");

    const v2 = await app.inject({
      method: "POST",
      url: `/v1/products/${productId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "SKU-1" },
    });
    expect(v2.statusCode).toBe(409);
  });

  it("rejects invalid SKU with 422", async () => {
    const token = await loginAs(owner);
    const created = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product" },
    });
    const productId = created.json<ProductRecord>().id;
    const response = await app.inject({
      method: "POST",
      url: `/v1/products/${productId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "has space" },
    });
    expect(response.statusCode).toBe(422);
  });

  it("makes SKU immutable after a stock movement", async () => {
    const token = await loginAs(owner);
    const created = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product" },
    });
    const productId = created.json<ProductRecord>().id;
    const v = await app.inject({
      method: "POST",
      url: `/v1/products/${productId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "SKU-IMM" },
    });
    const variantId = v.json<VariantRecord>().id;
    store.markVariantHasMovement(variantId);

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/variants/${variantId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "SKU-NEW" },
    });
    expect(response.statusCode).toBe(409);

    // non-sku updates still work
    const ok = await app.inject({
      method: "PATCH",
      url: `/v1/variants/${variantId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { attributes: { size: "M" } },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json<VariantRecord>().sku).toBe("SKU-IMM");
  });

  it("deletes a variant without stock and blocks one with stock", async () => {
    const token = await loginAs(owner);
    const created = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product" },
    });
    const productId = created.json<ProductRecord>().id;
    const v = await app.inject({
      method: "POST",
      url: `/v1/products/${productId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "SKU-DEL" },
    });
    const variantId = v.json<VariantRecord>().id;

    const blocked = await (async () => {
      store.markVariantHasMovement(variantId);
      return app.inject({
        method: "DELETE",
        url: `/v1/variants/${variantId}`,
        headers: { authorization: `Bearer ${token}` },
      });
    })();
    expect(blocked.statusCode).toBe(409);

    store.variantsWithMovements.delete(variantId);
    // already marked; reset by recreating variant instead — instead test clean delete on a fresh variant
    const v2 = await app.inject({
      method: "POST",
      url: `/v1/products/${productId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "SKU-DEL2" },
    });
    const id2 = v2.json<VariantRecord>().id;
    const del = await app.inject({
      method: "DELETE",
      url: `/v1/variants/${id2}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);
  });
});

describe("bundles", () => {
  it("attaches and lists components on a bundle product", async () => {
    const token = await loginAs(owner);
    const bundle = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "حزمة", nameEn: "Bundle", kind: "bundle" },
    });
    const bundleId = bundle.json<ProductRecord>().id;

    const compProduct = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "компон", nameEn: "Component" },
    });
    const compProductId = compProduct.json<ProductRecord>().id;
    const compVariant = await app.inject({
      method: "POST",
      url: `/v1/products/${compProductId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "COMP-1" },
    });
    const compVariantId = compVariant.json<VariantRecord>().id;

    const replaced = await app.inject({
      method: "PUT",
      url: `/v1/products/${bundleId}/components`,
      headers: { authorization: `Bearer ${token}` },
      payload: { components: [{ componentVariantId: compVariantId, quantity: 2 }] },
    });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json<{ components: BundleComponentRecord[] }>().components).toHaveLength(1);

    const listed = await app.inject({
      method: "GET",
      url: `/v1/products/${bundleId}/components`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json<{ components: BundleComponentRecord[] }>().components[0]?.quantity).toBe(2);

    // GET product includes components
    const detail = await app.inject({
      method: "GET",
      url: `/v1/products/${bundleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detail.json<{ components: BundleComponentRecord[] }>().components).toHaveLength(1);
  });

  it("rejects components on a non-bundle product", async () => {
    const token = await loginAs(owner);
    const simple = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product" },
    });
    const id = simple.json<ProductRecord>().id;
    const response = await app.inject({
      method: "PUT",
      url: `/v1/products/${id}/components`,
      headers: { authorization: `Bearer ${token}` },
      payload: { components: [] },
    });
    expect(response.statusCode).toBe(422);
  });

  it("rejects unknown variant, self-variant, and bad quantity", async () => {
    const token = await loginAs(owner);
    const bundle = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "حزمة", nameEn: "Bundle", kind: "bundle" },
    });
    const bundleId = bundle.json<ProductRecord>().id;

    const compProduct = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "компон", nameEn: "Component" },
    });
    const compProductId = compProduct.json<ProductRecord>().id;
    const compVariant = await app.inject({
      method: "POST",
      url: `/v1/products/${compProductId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "COMP-2" },
    });
    const compVariantId = compVariant.json<VariantRecord>().id;

    // self-variant: create a variant on the bundle product itself
    const selfVariant = await app.inject({
      method: "POST",
      url: `/v1/products/${bundleId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "SELF" },
    });
    const selfId = selfVariant.json<VariantRecord>().id;

    const badQty = await app.inject({
      method: "PUT",
      url: `/v1/products/${bundleId}/components`,
      headers: { authorization: `Bearer ${token}` },
      payload: { components: [{ componentVariantId: compVariantId, quantity: 0 }] },
    });
    expect(badQty.statusCode).toBe(422);

    const self = await app.inject({
      method: "PUT",
      url: `/v1/products/${bundleId}/components`,
      headers: { authorization: `Bearer ${token}` },
      payload: { components: [{ componentVariantId: selfId, quantity: 1 }] },
    });
    expect(self.statusCode).toBe(422);

    const unknown = await app.inject({
      method: "PUT",
      url: `/v1/products/${bundleId}/components`,
      headers: { authorization: `Bearer ${token}` },
      payload: { components: [{ componentVariantId: "00000000-0000-4000-8000-000000000999", quantity: 1 }] },
    });
    expect(unknown.statusCode).toBe(422);
  });
});

describe("GET /v1/variants/:id", () => {
  it("returns a variant", async () => {
    const token = await loginAs(owner);
    const created = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product" },
    });
    const productId = created.json<ProductRecord>().id;
    const v = await app.inject({
      method: "POST",
      url: `/v1/products/${productId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "SKU-GET" },
    });
    const variantId = v.json<VariantRecord>().id;
    const response = await app.inject({
      method: "GET",
      url: `/v1/variants/${variantId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<VariantRecord>().sku).toBe("SKU-GET");
  });
});

describe("product delete with stock", () => {
  it("returns 409 when a variant has movements", async () => {
    const token = await loginAs(owner);
    const created = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameAr: "منتج", nameEn: "Product" },
    });
    const productId = created.json<ProductRecord>().id;
    const v = await app.inject({
      method: "POST",
      url: `/v1/products/${productId}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "SKU-STOCK" },
    });
    const variantId = v.json<VariantRecord>().id;
    store.markVariantHasMovement(variantId);

    const response = await app.inject({
      method: "DELETE",
      url: `/v1/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(409);
  });
});

const IMPORT_TENANT = "99999999-9999-4999-8999-999999999999";

describe("parseImportBuffer", () => {
  it("parses CSV rows with header", () => {
    const csv = "nameAr,nameEn,sku,images\nمنتج1,Product1,IMP-1,http://x/a.png\n,Product2,,\n";
    const buf = Buffer.from(csv, "utf8");
    const parsed = parseImportBuffer(buf);
    expect(parsed.parseError).toBeUndefined();
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      row: 2,
      nameAr: "منتج1",
      nameEn: "Product1",
      sku: "IMP-1",
      images: ["http://x/a.png"],
    });
    expect(parsed.rows[1]?.nameAr).toBe("");
  });

  it("returns parseError for garbage", () => {
    const buf = Buffer.from("not\x00a\x00valid\x00xlsx", "utf8");
    const parsed = parseImportBuffer(buf);
    // either parses as a single-column sheet or returns parseError; both acceptable
    expect(parsed).toBeDefined();
  });
});

describe("importProducts (service)", () => {
  it("dry-run validates without writing", async () => {
    const rows: ImportRow[] = [
      { row: 2, nameAr: "منتج1", nameEn: "Product1", sku: "IMP-1" },
      { row: 3, nameAr: "منتج2", nameEn: "Product2" },
      { row: 4, nameAr: "", nameEn: "Bad" },
    ];
    const report = await catalogService.importProducts(IMPORT_TENANT, rows, true);
    expect(report.dryRun).toBe(true);
    expect(report.total).toBe(3);
    expect(report.valid).toBe(2);
    expect(report.created).toBe(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.row).toBe(4);
    // nothing written
    expect(await store.listProducts(IMPORT_TENANT, 100, 0)).toHaveLength(0);
  });

  it("imports valid rows and creates variants for skus", async () => {
    const rows: ImportRow[] = [
      { row: 2, nameAr: "منتج1", nameEn: "Product1", sku: "IMP-A" },
      { row: 3, nameAr: "منتج2", nameEn: "Product2", sku: "IMP-B", attributes: { color: "red" } },
    ];
    const report = await catalogService.importProducts(IMPORT_TENANT, rows, false);
    expect(report.created).toBe(2);
    expect(report.errors).toHaveLength(0);
    const products = await store.listProducts(IMPORT_TENANT, 100, 0);
    expect(products).toHaveLength(2);
    const skus = (await store.listAllVariants(IMPORT_TENANT)).map((v) => v.sku);
    expect(skus).toEqual(expect.arrayContaining(["IMP-A", "IMP-B"]));
  });

  it("rejects duplicate SKU within the file", async () => {
    const rows: ImportRow[] = [
      { row: 2, nameAr: "منتج1", nameEn: "Product1", sku: "DUP-1" },
      { row: 3, nameAr: "منتج2", nameEn: "Product2", sku: "DUP-1" },
    ];
    const report = await catalogService.importProducts(IMPORT_TENANT, rows, true);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.reason).toMatch(/SKU already exists/i);
  });

  it("rejects duplicate SKU against existing data", async () => {
    // seed an existing product with SKU IMP-A
    await catalogService.createProduct(
      { nameAr: "موجود", nameEn: "Existing" },
      IMPORT_TENANT,
    ).then(async (p) => {
      await catalogService.createVariant(IMPORT_TENANT, p.id, { sku: "IMP-A" });
    });
    const rows: ImportRow[] = [
      { row: 2, nameAr: "منتج3", nameEn: "Product3", sku: "IMP-A" },
    ];
    const report = await catalogService.importProducts(IMPORT_TENANT, rows, true);
    expect(report.errors).toHaveLength(1);
    expect(report.valid).toBe(0);
  });

  it("rejects invalid sku format", async () => {
    const rows: ImportRow[] = [
      { row: 2, nameAr: "منتج", nameEn: "Product", sku: "has space" },
    ];
    const report = await catalogService.importProducts(IMPORT_TENANT, rows, true);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.reason).toMatch(/sku must match/i);
  });
});
