import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { StockService } from "../src/stock/service";
import type { StockMovementRecord, StockStore } from "../src/stock/types";
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
  TENANT_A,
  ownerUser,
  viewerUser,
} from "./fakes";

class FakeStockStore implements StockStore {
  readonly movements: StockMovementRecord[] = [];
  readonly balances = new Map<string, number>();

  private key(tenantId: string, variantId: string, locationId: string, bucket: string): string {
    return `${tenantId}:${variantId}:${locationId}:${bucket}`;
  }

  async applyMovement(movement: StockMovementRecord): Promise<void> {
    this.movements.push({ ...movement });
    const key = this.key(movement.tenantId, movement.variantId, movement.locationId!, movement.bucket);
    this.balances.set(key, (this.balances.get(key) ?? 0) + movement.delta);
  }

  async getBalance(tenantId: string, variantId: string, locationId: string, bucket: StockMovementRecord["bucket"] & string): Promise<number> {
    return this.balances.get(this.key(tenantId, variantId, locationId, bucket)) ?? 0;
  }

  async getBalances(tenantId: string, variantId: string, locationId: string): Promise<Record<string, number>> {
    const buckets = ["on_hand", "reserved", "quarantined", "damaged", "in_transit"];
    const result: Record<string, number> = {};
    for (const b of buckets) {
      result[b] = this.balances.get(this.key(tenantId, variantId, locationId, b)) ?? 0;
    }
    return result as Record<"on_hand" | "reserved" | "quarantined" | "damaged" | "in_transit", number>;
  }

  async listMovements(tenantId: string, filters: { variantId?: string; locationId?: string }): Promise<StockMovementRecord[]> {
    return this.movements
      .filter((m) => m.tenantId === tenantId)
      .filter((m) => (filters.variantId ? m.variantId === filters.variantId : true))
      .filter((m) => (filters.locationId ? m.locationId === filters.locationId : true))
      .map((m) => ({ ...m }));
  }
}

const owner: UserRecord = ownerUser;
const viewer: UserRecord = viewerUser;

let app: FastifyInstance;
let clock: FakeClock;
let store: FakeStockStore;
let auth: AuthService;
let stockService: StockService;
let auditWriter: FakeAuditWriter;

beforeEach(() => {
  clock = new FakeClock();
  store = new FakeStockStore();
  auditWriter = new FakeAuditWriter();
  auth = new AuthService({
    users: new FakeDirectory([owner, viewer]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: new FakeLimiter(),
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });
  stockService = new StockService({ store, clock });

  app = buildApp({
    logger: false,
    auth,
    stock: stockService,
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

const V = "00000000-0000-4000-8000-000000000001";
const L = "00000000-0000-4000-8000-000000000002";

describe("StockService.recordMovement", () => {
  it("creates a movement and updates the balance", async () => {
    const m = await stockService.recordMovement(
      { variantId: V, locationId: L, bucket: "on_hand", delta: 5, reason: "RECEIPT" },
      "tenant-1",
      { kind: "user", id: "u1" },
    );
    expect(m.id).toBeDefined();
    expect(await stockService.getBalance("tenant-1", V, L, "on_hand")).toBe(5);
  });

  it("rejects invalid bucket, non-integer delta, missing reason", async () => {
    await expect(
      stockService.recordMovement(
        { variantId: V, locationId: L, bucket: "bogus" as never, delta: 1, reason: "R" },
        "tenant-1",
        { kind: "user", id: "u1" },
      ),
    ).rejects.toThrow();
    await expect(
      stockService.recordMovement(
        { variantId: V, locationId: L, bucket: "on_hand", delta: 1.5, reason: "R" },
        "tenant-1",
        { kind: "user", id: "u1" },
      ),
    ).rejects.toThrow();
    await expect(
      stockService.recordMovement(
        { variantId: V, locationId: L, bucket: "on_hand", delta: 1, reason: "" },
        "tenant-1",
        { kind: "user", id: "u1" },
      ),
    ).rejects.toThrow();
  });

  it("property: balance equals sum of deltas per bucket (random sequence)", async () => {
    const buckets = ["on_hand", "reserved", "quarantined", "damaged", "in_transit"] as const;
    const deltas: Record<string, number> = { on_hand: 0, reserved: 0, quarantined: 0, damaged: 0, in_transit: 0 };
    const rng = (n: number) => Math.floor(Math.random() * n);
    for (let i = 0; i < 200; i++) {
      const bucket = buckets[rng(buckets.length)]!;
      const delta = rng(21) - 10;
      deltas[bucket] = (deltas[bucket] ?? 0) + delta;
      await stockService.recordMovement(
        { variantId: V, locationId: L, bucket, delta, reason: "TEST" },
        "tenant-1",
        { kind: "system", id: null },
      );
    }
    for (const b of buckets) {
      const bal = await stockService.getBalance("tenant-1", V, L, b);
      expect(bal).toBe(deltas[b]);
    }
    const balances = await stockService.getBalances("tenant-1", V, L);
    for (const b of buckets) {
      expect(balances[b]).toBe(deltas[b]);
    }
    const movements = await stockService.listMovements("tenant-1", { variantId: V, locationId: L });
    expect(movements).toHaveLength(200);
  });
});

describe("GET /v1/stock/balances", () => {
  it("returns balances per bucket", async () => {
    const token = await loginAs(owner);
    await stockService.recordMovement(
      { variantId: V, locationId: L, bucket: "on_hand", delta: 7, reason: "R" },
      TENANT_A,
      { kind: "user", id: "u1" },
    );
    const res = await app.inject({
      method: "GET",
      url: `/v1/stock/balances?variantId=${V}&locationId=${L}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ balances: { on_hand: number } }>().balances.on_hand).toBe(7);
  });

  it("requires both params", async () => {
    const token = await loginAs(owner);
    const res = await app.inject({
      method: "GET",
      url: `/v1/stock/balances?variantId=${V}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
  });
});
