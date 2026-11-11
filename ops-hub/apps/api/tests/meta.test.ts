import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { AuthService } from "../src/auth/service";
import { ADJUSTMENT_REASONS } from "../src/stock/adjustment-reasons";
import { AdjustmentService } from "../src/stock/adjustment-service";
import { StockService } from "../src/stock/service";
import type {
  StockBalanceRecord,
  StockMovementRecord,
  StockStore,
} from "../src/stock/types";
import {
  FakeAuditWriter,
  FakeClock,
  FakeDirectory,
  FakeHasher,
  FakeSessions,
  SESSION_TTL_SECONDS,
  ownerUser,
} from "./fakes";

let app: FastifyInstance;

function fakeStore(): StockStore {
  return {
    async recordMovement(record) {
      const movement: StockMovementRecord = record;
      const balance: StockBalanceRecord = {
        id: "balance-1",
        tenantId: record.tenantId,
        variantId: record.variantId,
        locationId: record.locationId!,
        bucket: record.bucket,
        quantity: record.delta,
        updatedAt: record.createdAt,
      };
      return { movement, balance };
    },
    async listMovements() {
      return [];
    },
    async listBalances() {
      return [];
    },
  };
}

beforeEach(() => {
  const clock = new FakeClock();
  const auth = new AuthService({
    users: new FakeDirectory([ownerUser]),
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
  const stock = new StockService({ store: fakeStore(), clock });
  app = buildApp({
    logger: false,
    auth,
    audit: new FakeAuditWriter(),
    adjustments: new AdjustmentService(stock),
  });
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

describe("GET /v1/meta/enums", () => {
  it("serves the same adjustment reasons the adjustments endpoint validates against", async () => {
    const token = await loginAs(ownerUser);
    const response = await app.inject({
      method: "GET",
      url: "/v1/meta/enums",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(
      response.json<{ adjustmentReasons: string[] }>().adjustmentReasons,
    ).toEqual([...ADJUSTMENT_REASONS]);
  });
});

describe("POST /v1/inventory/adjustments", () => {
  it("rejects a request with no reason using 422", async () => {
    const token = await loginAs(ownerUser);
    const response = await app.inject({
      method: "POST",
      url: "/v1/inventory/adjustments",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        variantId: "v1",
        locationId: "l1",
        bucket: "on_hand",
        delta: 1,
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it("accepts a request with a valid enum reason", async () => {
    const token = await loginAs(ownerUser);
    const response = await app.inject({
      method: "POST",
      url: "/v1/inventory/adjustments",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        variantId: "v1",
        locationId: "l1",
        bucket: "on_hand",
        delta: -1,
        reason: "DAMAGE",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ reason: "DAMAGE" });
  });
});
