import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { AuthService } from "../src/auth/service";
import { CatalogService } from "../src/catalog/service";
import type {
  ProductRecord,
  ProductStore,
  VariantRecord,
  VariantStore,
} from "../src/catalog/types";
import {
  FakeAuditWriter,
  FakeClock,
  FakeDirectory,
  FakeHasher,
  FakeSessions,
  SESSION_TTL_SECONDS,
  ownerUser,
  viewerUser,
} from "./fakes";

class InMemoryProductStore implements ProductStore {
  readonly rows: ProductRecord[] = [];

  async create(record: ProductRecord): Promise<void> {
    this.rows.push(record);
  }

  async getById(tenantId: string, id: string): Promise<ProductRecord | null> {
    return (
      this.rows.find((row) => row.tenantId === tenantId && row.id === id) ??
      null
    );
  }

  async list(tenantId: string): Promise<ProductRecord[]> {
    return this.rows.filter((row) => row.tenantId === tenantId);
  }

  async update(
    tenantId: string,
    id: string,
    fields: Partial<ProductRecord>,
    updatedAt: Date,
  ): Promise<ProductRecord | null> {
    const row = await this.getById(tenantId, id);
    if (!row) return null;
    Object.assign(row, fields, { updatedAt });
    return row;
  }
}

class InMemoryVariantStore implements VariantStore {
  readonly rows: VariantRecord[] = [];

  async create(record: VariantRecord): Promise<void> {
    this.rows.push(record);
  }

  async getById(tenantId: string, id: string): Promise<VariantRecord | null> {
    return (
      this.rows.find((row) => row.tenantId === tenantId && row.id === id) ??
      null
    );
  }

  async getBySku(tenantId: string, sku: string): Promise<VariantRecord | null> {
    return (
      this.rows.find((row) => row.tenantId === tenantId && row.sku === sku) ??
      null
    );
  }

  async listByProduct(
    tenantId: string,
    productId: string,
  ): Promise<VariantRecord[]> {
    return this.rows.filter(
      (row) => row.tenantId === tenantId && row.productId === productId,
    );
  }

  async update(
    tenantId: string,
    id: string,
    fields: Partial<VariantRecord>,
    updatedAt: Date,
  ): Promise<VariantRecord | null> {
    const row = await this.getById(tenantId, id);
    if (!row) return null;
    Object.assign(row, fields, { updatedAt });
    return row;
  }
}

let app: FastifyInstance;
let audit: FakeAuditWriter;

beforeEach(() => {
  const clock = new FakeClock();
  const auth = new AuthService({
    users: new FakeDirectory([ownerUser, viewerUser]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: {
      blockedFor: async () => 0,
      recordFailure: async () => {},
      reset: async () => {},
    },
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });
  const catalog = new CatalogService({
    products: new InMemoryProductStore(),
    variants: new InMemoryVariantStore(),
    clock,
  });
  audit = new FakeAuditWriter();

  app = buildApp({ logger: false, auth, catalog, audit });
});

afterEach(async () => {
  await app.close();
});

async function loginAs(user: typeof ownerUser): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: user.email, password: "correct-horse" },
  });
  return response.json<{ token: string }>().token;
}

async function createProduct(token: string) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/products",
    headers: { authorization: `Bearer ${token}` },
    payload: { nameEn: "T-Shirt", nameAr: "تيشيرت" },
  });
  return response.json<{ id: string }>();
}

describe("POST /v1/products", () => {
  it("creates a product and audits it", async () => {
    const token = await loginAs(ownerUser);
    const response = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameEn: "T-Shirt", nameAr: "تيشيرت" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      nameEn: "T-Shirt",
      nameAr: "تيشيرت",
      status: "draft",
    });
    // Login itself audits (a session was created); the product create is the
    // last entry.
    expect(audit.entries.at(-1)).toMatchObject({ action: "product.created" });
  });

  it("denies roles without products:write", async () => {
    const token = await loginAs(viewerUser);
    const response = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameEn: "T-Shirt", nameAr: "تيشيرت" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("rejects a missing name with 422", async () => {
    const token = await loginAs(ownerUser);
    const response = await app.inject({
      method: "POST",
      url: "/v1/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { nameEn: "", nameAr: "تيشيرت" },
    });

    expect(response.statusCode).toBe(422);
  });
});

describe("POST /v1/variants", () => {
  it("creates a variant under a product", async () => {
    const token = await loginAs(ownerUser);
    const product = await createProduct(token);

    const response = await app.inject({
      method: "POST",
      url: "/v1/variants",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        productId: product.id,
        sku: "TSHIRT-RED-M",
        attributes: { color: "red", size: "M" },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ sku: "TSHIRT-RED-M" });
  });

  it("returns 409 for a duplicate SKU", async () => {
    const token = await loginAs(ownerUser);
    const product = await createProduct(token);
    const payload = {
      productId: product.id,
      sku: "TSHIRT-RED-L",
      attributes: { color: "red", size: "L" },
    };

    const first = await app.inject({
      method: "POST",
      url: "/v1/variants",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/variants",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
  });
});

describe("PATCH /v1/variants/:id", () => {
  it("rejects a request that tries to change the SKU", async () => {
    const token = await loginAs(ownerUser);
    const product = await createProduct(token);
    const created = await app.inject({
      method: "POST",
      url: "/v1/variants",
      headers: { authorization: `Bearer ${token}` },
      payload: { productId: product.id, sku: "FIXED-SKU-001" },
    });
    const variant = created.json<{ id: string }>();

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/variants/${variant.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { sku: "NEW-SKU-001" },
    });

    expect(response.statusCode).toBe(422);
  });

  it("allows changing attributes without touching the SKU", async () => {
    const token = await loginAs(ownerUser);
    const product = await createProduct(token);
    const created = await app.inject({
      method: "POST",
      url: "/v1/variants",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        productId: product.id,
        sku: "RENAME-ME-001",
        attributes: { size: "S" },
      },
    });
    const variant = created.json<{ id: string }>();

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/variants/${variant.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { attributes: { size: "M" } },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      sku: "RENAME-ME-001",
      attributes: { size: "M" },
    });
  });
});
