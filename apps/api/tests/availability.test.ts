import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { AvailabilityService } from "../src/availability/service";
import { StockService } from "../src/stock/service";
import type { StockStore } from "../src/stock/types";
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
// FakeCatalogStore/FakeStockStore are defined in catalog.test.ts / stock.test.ts, not exported.
// Re-define minimal fakes here instead.

import type { CatalogStore, VariantRecord, ProductRecord } from "../src/catalog/types";

class FakeCatalogStore2 implements CatalogStore {
  readonly products = new Map<string, ProductRecord>();
  readonly variants = new Map<string, VariantRecord>();
  readonly components = new Map<string, never[]>();
  readonly variantsWithMovements = new Set<string>();

  private key(tenantId: string, id: string) { return `${tenantId}:${id}`; }

  async createProduct(p: ProductRecord) { this.products.set(this.key(p.tenantId, p.id), { ...p }); }
  async getProduct(tenantId: string, id: string) { const p = this.products.get(this.key(tenantId, id)); return p ? { ...p } : null; }
  async listProducts(tenantId: string, limit: number, offset: number) {
    return [...this.products.values()].filter((p) => p.tenantId === tenantId).slice(offset, offset + limit).map((p) => ({ ...p }));
  }
  async updateProduct(p: ProductRecord) { const k = this.key(p.tenantId, p.id); if (!this.products.has(k)) return false; this.products.set(k, { ...p }); return true; }
  async deleteProduct(tenantId: string, id: string) { const k = this.key(tenantId, id); if (!this.products.has(k)) return null; this.products.delete(k); return "deleted"; }
  async createVariant(v: VariantRecord) { this.variants.set(this.key(v.tenantId, v.id), { ...v }); }
  async getVariant(tenantId: string, id: string) { const v = this.variants.get(this.key(tenantId, id)); return v ? { ...v } : null; }
  async getVariantBySku(tenantId: string, sku: string) {
    const v = [...this.variants.values()].find((x) => x.tenantId === tenantId && x.sku === sku);
    return v ? { ...v } : null;
  }
  async listVariantsByProduct(tenantId: string, productId: string) {
    return [...this.variants.values()].filter((v) => v.tenantId === tenantId && v.productId === productId).map((v) => ({ ...v }));
  }
  async listAllVariants(tenantId: string) {
    return [...this.variants.values()].filter((v) => v.tenantId === tenantId).map((v) => ({ ...v }));
  }
  async updateVariant(v: VariantRecord) { const k = this.key(v.tenantId, v.id); if (!this.products.has(k) && !this.variants.has(k)) return false; this.variants.set(k, { ...v }); return true; }
  async deleteVariant(tenantId: string, id: string) { const k = this.key(tenantId, id); if (!this.variants.has(k)) return null; this.variants.delete(k); return "deleted"; }
  async hasStockMovements() { return false; }
  async replaceComponents() { /* noop */ }
  async listComponents() { return []; }
}

class FakeStockStore2 implements StockStore {
  readonly balances = new Map<string, number>();
  readonly locations = new Set<string>();

  private key(tenantId: string, variantId: string, locationId: string, bucket: string) {
    return `${tenantId}:${variantId}:${locationId}:${bucket}`;
  }

  async applyMovement(m: { tenantId: string; variantId: string; locationId: string | null; bucket: string; delta: number }) {
    const loc = m.locationId!;
    this.locations.add(loc);
    const k = this.key(m.tenantId, m.variantId, loc, m.bucket);
    this.balances.set(k, (this.balances.get(k) ?? 0) + m.delta);
  }

  async getBalance(tenantId: string, variantId: string, locationId: string, bucket: string) {
    return this.balances.get(this.key(tenantId, variantId, locationId, bucket)) ?? 0;
  }

  async getBalances(tenantId: string, variantId: string, locationId: string) {
    const buckets = ["on_hand", "reserved", "quarantined", "damaged", "in_transit"];
    const result: Record<string, number> = {};
    for (const b of buckets) result[b] = this.balances.get(this.key(tenantId, variantId, locationId, b)) ?? 0;
    return result as never;
  }

  async listMovements() { return []; }
  async listLocationsWithBalance(tenantId: string, variantId: string) {
    const set = new Set<string>();
    for (const k of this.balances.keys()) {
      const [t, v, loc] = k.split(":");
      if (t === tenantId && v === variantId) set.add(loc!);
    }
    return [...set];
  }
}

const owner: UserRecord = ownerUser;
const viewer: UserRecord = viewerUser;

let app: FastifyInstance;
let clock: FakeClock;
let catalogStore: FakeCatalogStore2;
let stockStore: FakeStockStore2;
let stockService: StockService;
let availabilityService: AvailabilityService;
let auth: AuthService;
let auditWriter: FakeAuditWriter;

const V = "00000000-0000-4000-8000-000000000001";
const L1 = "00000000-0000-4000-8000-000000000011";
const L2 = "00000000-0000-4000-8000-000000000022";
const TENANT = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  clock = new FakeClock();
  catalogStore = new FakeCatalogStore2();
  stockStore = new FakeStockStore2();
  auditWriter = new FakeAuditWriter();
  auth = new AuthService({
    users: new FakeDirectory([owner, viewer]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: new FakeLimiter(),
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });
  stockService = new StockService({ store: stockStore, clock });
  availabilityService = new AvailabilityService({ stock: stockStore, catalog: catalogStore });

  // seed variant
  catalogStore.variants.set(`${TENANT}:${V}`, {
    id: V,
    tenantId: TENANT,
    productId: "p1",
    sku: "SKU-A",
    attributes: {},
    images: [],
    createdAt: clock.now(),
    updatedAt: clock.now(),
  });

  app = buildApp({
    logger: false,
    auth,
    stock: stockService,
    availability: availabilityService,
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

describe("AvailabilityService", () => {
  it("computes ATP = on_hand - reserved - quarantined - damaged", async () => {
    // seed stock: on_hand 10, reserved 2, quarantined 1, damaged 1
    await stockService.recordMovement({ variantId: V, locationId: L1, bucket: "on_hand", delta: 10, reason: "R" }, TENANT, { kind: "system", id: null });
    await stockService.recordMovement({ variantId: V, locationId: L1, bucket: "reserved", delta: 2, reason: "R" }, TENANT, { kind: "system", id: null });
    await stockService.recordMovement({ variantId: V, locationId: L1, bucket: "quarantined", delta: 1, reason: "R" }, TENANT, { kind: "system", id: null });
    await stockService.recordMovement({ variantId: V, locationId: L1, bucket: "damaged", delta: 1, reason: "R" }, TENANT, { kind: "system", id: null });

    const report = await availabilityService.getAvailability(TENANT, "SKU-A", L1, false);
    expect(report.available).toBe(6); // 10-2-1-1
    expect(report.totalAvailable).toBe(6);
  });

  it("clamps negative ATP to 0 unless allowNegative", async () => {
    const V2 = "00000000-0000-4000-8000-000000000002";
    catalogStore.variants.set(`${TENANT}:${V2}`, {
      id: V2, tenantId: TENANT, productId: "p1", sku: "SKU-B", attributes: {}, images: [],
      createdAt: clock.now(), updatedAt: clock.now(),
    });
    await stockService.recordMovement({ variantId: V2, locationId: L1, bucket: "on_hand", delta: 1, reason: "R" }, TENANT, { kind: "system", id: null });
    await stockService.recordMovement({ variantId: V2, locationId: L1, bucket: "reserved", delta: 5, reason: "R" }, TENANT, { kind: "system", id: null });

    const clamped = await availabilityService.getAvailability(TENANT, "SKU-B", L1, false);
    expect(clamped.available).toBe(0);
    const raw = await availabilityService.getAvailability(TENANT, "SKU-B", L1, true);
    expect(raw.available).toBe(-4);
  });

  it("totals across locations", async () => {
    const V3 = "00000000-0000-4000-8000-000000000003";
    catalogStore.variants.set(`${TENANT}:${V3}`, {
      id: V3, tenantId: TENANT, productId: "p1", sku: "SKU-C", attributes: {}, images: [],
      createdAt: clock.now(), updatedAt: clock.now(),
    });
    await stockService.recordMovement({ variantId: V3, locationId: L1, bucket: "on_hand", delta: 5, reason: "R" }, TENANT, { kind: "system", id: null });
    await stockService.recordMovement({ variantId: V3, locationId: L2, bucket: "on_hand", delta: 3, reason: "R" }, TENANT, { kind: "system", id: null });

    const report = await availabilityService.getAvailability(TENANT, "SKU-C", undefined, false);
    expect(report.totalAvailable).toBe(8);
    expect(report.available).toBe(8);
    expect(report.byLocation).toHaveLength(2);
  });

  it("throws for unknown sku", async () => {
    await expect(
      availabilityService.getAvailability(TENANT, "NOPE", L1, false),
    ).rejects.toThrow();
  });
});

describe("GET /v1/inventory/availability", () => {
  it("returns availability", async () => {
    const token = await loginAs(owner);
    await stockService.recordMovement({ variantId: V, locationId: L1, bucket: "on_hand", delta: 4, reason: "R" }, TENANT, { kind: "system", id: null });

    const res = await app.inject({
      method: "GET",
      url: `/v1/inventory/availability?sku=SKU-A&location=${L1}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ available: number; totalAvailable: number }>();
    expect(body.available).toBeGreaterThanOrEqual(0);
  });

  it("requires sku", async () => {
    const token = await loginAs(owner);
    const res = await app.inject({
      method: "GET",
      url: "/v1/inventory/availability",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
  });
});
