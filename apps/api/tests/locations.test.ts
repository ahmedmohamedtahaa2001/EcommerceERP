import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { LocationService } from "../src/locations/service";
import type {
  BinRecord,
  LocationRecord,
  LocationStore,
} from "../src/locations/types";
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

class FakeLocationStore implements LocationStore {
  readonly locations = new Map<string, LocationRecord>();
  readonly bins = new Map<string, BinRecord>();
  readonly locationsWithStock = new Set<string>();

  private key(tenantId: string, id: string): string {
    return `${tenantId}:${id}`;
  }

  async createLocation(location: LocationRecord): Promise<void> {
    const dup = [...this.locations.values()].some(
      (l) => l.tenantId === location.tenantId && l.code !== null && l.code === location.code,
    );
    if (dup) {
      const err = new Error("dup") as Error & { code: string };
      err.code = "23505";
      throw err;
    }
    this.locations.set(this.key(location.tenantId, location.id), { ...location });
  }

  async getLocation(tenantId: string, id: string): Promise<LocationRecord | null> {
    const l = this.locations.get(this.key(tenantId, id));
    return l ? { ...l } : null;
  }

  async listLocations(tenantId: string): Promise<LocationRecord[]> {
    return [...this.locations.values()]
      .filter((l) => l.tenantId === tenantId)
      .map((l) => ({ ...l }));
  }

  async updateLocation(location: LocationRecord): Promise<boolean> {
    const key = this.key(location.tenantId, location.id);
    if (!this.locations.has(key)) return false;
    const dup = [...this.locations.values()].some(
      (l) =>
        l.tenantId === location.tenantId &&
        l.code !== null &&
        l.code === location.code &&
        l.id !== location.id,
    );
    if (dup) {
      const err = new Error("dup") as Error & { code: string };
      err.code = "23505";
      throw err;
    }
    this.locations.set(key, { ...location });
    return true;
  }

  async deleteLocation(
    tenantId: string,
    id: string,
  ): Promise<"deleted" | "has_stock" | null> {
    const key = this.key(tenantId, id);
    if (!this.locations.has(key)) return null;
    if (this.locationsWithStock.has(id)) return "has_stock";
    this.locations.delete(key);
    for (const [k, b] of [...this.bins.entries()]) {
      if (b.tenantId === tenantId && b.locationId === id) this.bins.delete(k);
    }
    return "deleted";
  }

  async createBin(bin: BinRecord): Promise<void> {
    const dup = [...this.bins.values()].some(
      (b) => b.locationId === bin.locationId && b.code === bin.code,
    );
    if (dup) {
      const err = new Error("dup") as Error & { code: string };
      err.code = "23505";
      throw err;
    }
    this.bins.set(this.key(bin.tenantId, bin.id), { ...bin });
  }

  async getBin(tenantId: string, id: string): Promise<BinRecord | null> {
    const b = this.bins.get(this.key(tenantId, id));
    return b ? { ...b } : null;
  }

  async listBinsByLocation(tenantId: string, locationId: string): Promise<BinRecord[]> {
    return [...this.bins.values()]
      .filter((b) => b.tenantId === tenantId && b.locationId === locationId)
      .map((b) => ({ ...b }));
  }

  async updateBin(bin: BinRecord): Promise<boolean> {
    const key = this.key(bin.tenantId, bin.id);
    if (!this.bins.has(key)) return false;
    const dup = [...this.bins.values()].some(
      (b) =>
        b.locationId === bin.locationId &&
        b.code === bin.code &&
        b.id !== bin.id,
    );
    if (dup) {
      const err = new Error("dup") as Error & { code: string };
      err.code = "23505";
      throw err;
    }
    this.bins.set(key, { ...bin });
    return true;
  }

  async deleteBin(tenantId: string, id: string): Promise<"deleted" | "has_stock" | null> {
    const key = this.key(tenantId, id);
    if (!this.bins.has(key)) return null;
    this.bins.delete(key);
    return "deleted";
  }

  markLocationHasStock(id: string): void {
    this.locationsWithStock.add(id);
  }
}

const owner: UserRecord = ownerUser;
const viewer: UserRecord = viewerUser;

let app: FastifyInstance;
let clock: FakeClock;
let store: FakeLocationStore;
let auth: AuthService;
let locationService: LocationService;
let auditWriter: FakeAuditWriter;

beforeEach(() => {
  clock = new FakeClock();
  store = new FakeLocationStore();
  auditWriter = new FakeAuditWriter();
  auth = new AuthService({
    users: new FakeDirectory([owner, viewer]),
    passwords: new FakeHasher(),
    sessions: new FakeSessions(clock),
    limiter: new FakeLimiter(),
    clock,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });
  locationService = new LocationService({ store, clock });

  app = buildApp({
    logger: false,
    auth,
    locations: locationService,
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

describe("locations", () => {
  it("creates a location and lists it", async () => {
    const token = await loginAs(owner);
    const res = await app.inject({
      method: "POST",
      url: "/v1/locations",
      headers: { authorization: `Bearer ${token}` },
      payload: { type: "warehouse", name: "Main WH", code: "WH-1", governorateCode: "GZ" },
    });
    expect(res.statusCode).toBe(201);
    const loc = res.json<LocationRecord>();
    expect(loc.type).toBe("warehouse");
    expect(loc.code).toBe("WH-1");

    const list = await app.inject({
      method: "GET",
      url: "/v1/locations",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json<{ locations: LocationRecord[] }>().locations).toHaveLength(1);
  });

  it("rejects invalid type with 422", async () => {
    const token = await loginAs(owner);
    const res = await app.inject({
      method: "POST",
      url: "/v1/locations",
      headers: { authorization: `Bearer ${token}` },
      payload: { type: "spaceship", name: "X" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("rejects duplicate location code with 409", async () => {
    const token = await loginAs(owner);
    await app.inject({
      method: "POST",
      url: "/v1/locations",
      headers: { authorization: `Bearer ${token}` },
      payload: { type: "warehouse", name: "A", code: "DUP" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/locations",
      headers: { authorization: `Bearer ${token}` },
      payload: { type: "warehouse", name: "B", code: "DUP" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("blocks deleting a location with stock", async () => {
    const token = await loginAs(owner);
    const res = await app.inject({
      method: "POST",
      url: "/v1/locations",
      headers: { authorization: `Bearer ${token}` },
      payload: { type: "warehouse", name: "WH", code: "WH-X" },
    });
    const id = res.json<LocationRecord>().id;
    store.markLocationHasStock(id);
    const del = await app.inject({
      method: "DELETE",
      url: `/v1/locations/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(409);
  });
});

describe("bins", () => {
  it("creates a bin under a location and enforces unique code per location", async () => {
    const token = await loginAs(owner);
    const locRes = await app.inject({
      method: "POST",
      url: "/v1/locations",
      headers: { authorization: `Bearer ${token}` },
      payload: { type: "warehouse", name: "WH", code: "WH-BIN" },
    });
    const locationId = locRes.json<LocationRecord>().id;

    const b1 = await app.inject({
      method: "POST",
      url: `/v1/locations/${locationId}/bins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { code: "A-01", zone: "A", capacity: 100 },
    });
    expect(b1.statusCode).toBe(201);

    const b2 = await app.inject({
      method: "POST",
      url: `/v1/locations/${locationId}/bins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { code: "A-01" },
    });
    expect(b2.statusCode).toBe(409);
  });

  it("returns 404 for unknown location", async () => {
    const token = await loginAs(owner);
    const res = await app.inject({
      method: "GET",
      url: "/v1/locations/00000000-0000-4000-8000-000000000999",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("updates and deletes a bin", async () => {
    const token = await loginAs(owner);
    const locRes = await app.inject({
      method: "POST",
      url: "/v1/locations",
      headers: { authorization: `Bearer ${token}` },
      payload: { type: "warehouse", name: "WH2" },
    });
    const locationId = locRes.json<LocationRecord>().id;
    const b = await app.inject({
      method: "POST",
      url: `/v1/locations/${locationId}/bins`,
      headers: { authorization: `Bearer ${token}` },
      payload: { code: "B-01" },
    });
    const binId = b.json<BinRecord>().id;

    const patch = await app.inject({
      method: "PATCH",
      url: `/v1/bins/${binId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { capacity: 50 },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json<BinRecord>().capacity).toBe(50);

    const del = await app.inject({
      method: "DELETE",
      url: `/v1/bins/${binId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);
  });
});
