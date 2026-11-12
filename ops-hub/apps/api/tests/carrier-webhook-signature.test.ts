import { createHmac, randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { ShippingCarrier } from "@ops-hub/integrations";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import type { ShipmentService } from "../src/shipments/service";
import { FakeAuditWriter } from "./fakes";

const SECRET = "bosta-test-secret";
const TENANT = "00000000-0000-4000-8000-00000000a901";
const ROUTE = `/v1/webhooks/carriers/bosta/${TENANT}`;
const TRACKING = "TRK-1";

interface Recorded {
  applied: Array<{
    tenantId: string;
    shipmentId: string;
    raw: string;
    mapping: unknown;
  }>;
  claimed: string[];
  released: string[];
}

function fakes(
  options: {
    knownTracking?: boolean;
    applyFails?: boolean;
    alreadyClaimed?: boolean;
  } = {},
) {
  const recorded: Recorded = { applied: [], claimed: [], released: [] };
  const claimedKeys = new Set<string>();
  const carrier = {
    parseWebhook: async (_headers: unknown, body: unknown) => {
      const b = body as {
        eventId: string;
        trackingNumber?: string;
        status: string;
      };
      return {
        eventId: b.eventId,
        trackingNumber: b.trackingNumber,
        event: {
          carrierStatus: b.status,
          status: "delivered",
          occurredAt: new Date("2026-11-12T10:00:00Z"),
          raw: body,
        },
        raw: body,
      };
    },
  } as unknown as ShippingCarrier;
  const shipments = {
    findByTrackingNumber: async (_tenant: string, tracking: string) =>
      options.knownTracking === false || tracking !== TRACKING
        ? null
        : { id: "shipment-1", trackingNumber: tracking },
    applyCarrierStatus: async (
      tenantId: string,
      shipmentId: string,
      raw: string,
      mapping: unknown,
    ) => {
      if (options.applyFails) throw new Error("database unavailable");
      recorded.applied.push({ tenantId, shipmentId, raw, mapping });
      return { unmapped: false, status: "delivered" };
    },
  } as unknown as ShipmentService;
  const events = {
    tryMarkProcessed: async (
      tenant: string,
      consumer: string,
      eventId: string,
    ) => {
      const key = `${tenant}|${consumer}|${eventId}`;
      recorded.claimed.push(key);
      if (options.alreadyClaimed || claimedKeys.has(key)) return false;
      claimedKeys.add(key);
      return true;
    },
    release: async (tenant: string, consumer: string, eventId: string) => {
      recorded.released.push(`${tenant}|${consumer}|${eventId}`);
      claimedKeys.delete(`${tenant}|${consumer}|${eventId}`);
    },
  };
  return { carrier, shipments, events, recorded };
}

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function build(
  secrets: Record<string, string | undefined>,
  options: Parameters<typeof fakes>[0] = {},
) {
  const f = fakes(options);
  app = buildApp({
    logger: false,
    shipments: f.shipments,
    audit: new FakeAuditWriter(),
    carriers: { bosta: f.carrier },
    carrierWebhookSecrets: secrets,
    carrierEvents: f.events,
    carrierStatusMappings: { bosta: { delivered: "delivered" } as never },
  });
  return { instance: app, recorded: f.recorded };
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function post(
  instance: FastifyInstance,
  body: string,
  signature: string | undefined,
  route = ROUTE,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (signature !== undefined) headers["x-carrier-signature"] = signature;
  return instance.inject({
    method: "POST",
    url: route,
    headers,
    payload: body,
  });
}

function payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    eventId: `evt-${randomUUID()}`,
    trackingNumber: TRACKING,
    status: "delivered",
    ...overrides,
  });
}

describe("carrier webhook signature verification", () => {
  it("applies a correctly signed status to the matching shipment", async () => {
    const { instance, recorded } = build({ bosta: SECRET });
    const body = payload();
    const res = await post(instance, body, sign(SECRET, body));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      matched: true,
      status: "delivered",
    });
    expect(recorded.applied).toEqual([
      expect.objectContaining({
        tenantId: TENANT,
        shipmentId: "shipment-1",
        raw: "delivered",
      }),
    ]);
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const { instance, recorded } = build({ bosta: SECRET });
    const body = payload();
    const res = await post(instance, body, sign("wrong-secret", body));
    expect(res.statusCode).toBe(401);
    expect(recorded.applied).toHaveLength(0);
  });

  it("rejects a valid signature replayed against a modified body", async () => {
    const { instance } = build({ bosta: SECRET });
    const body = payload();
    const tampered = body.replace("delivered", "returned");
    const res = await post(instance, tampered, sign(SECRET, body));
    expect(res.statusCode).toBe(401);
  });

  it("rejects a request with no signature header", async () => {
    const { instance } = build({ bosta: SECRET });
    const res = await post(instance, payload(), undefined);
    expect(res.statusCode).toBe(401);
  });

  it("fails closed when the carrier has no secret configured", async () => {
    const { instance } = build({});
    const body = payload();
    const res = await post(instance, body, sign(SECRET, body));
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for an unknown carrier or a malformed business id", async () => {
    const { instance } = build({ bosta: SECRET });
    const body = payload();
    const signature = sign(SECRET, body);
    expect(
      (
        await post(
          instance,
          body,
          signature,
          "/v1/webhooks/carriers/nope/" + TENANT,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await post(
          instance,
          body,
          signature,
          "/v1/webhooks/carriers/bosta/not-a-uuid",
        )
      ).statusCode,
    ).toBe(404);
  });
});

describe("carrier webhook processing", () => {
  it("acknowledges a tracking number we never issued without changing anything", async () => {
    const { instance, recorded } = build(
      { bosta: SECRET },
      { knownTracking: false },
    );
    const body = payload();
    const res = await post(instance, body, sign(SECRET, body));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, matched: false });
    expect(recorded.applied).toHaveLength(0);
  });

  it("refuses a payload without a tracking number", async () => {
    const { instance } = build({ bosta: SECRET });
    const body = JSON.stringify({ eventId: "evt-x", status: "delivered" });
    const res = await post(instance, body, sign(SECRET, body));
    expect(res.statusCode).toBe(422);
  });

  it("applies a redelivered event only once", async () => {
    const { instance, recorded } = build({ bosta: SECRET });
    const body = payload({ eventId: "evt-once" });
    const signature = sign(SECRET, body);
    await post(instance, body, signature);
    const again = await post(instance, body, signature);
    expect(again.json()).toEqual({ ok: true, duplicate: true });
    expect(recorded.applied).toHaveLength(1);
  });

  it("gives the claim back when applying fails, so the carrier's retry is not lost", async () => {
    const { instance, recorded } = build(
      { bosta: SECRET },
      { applyFails: true },
    );
    const body = payload({ eventId: "evt-retry" });
    const res = await post(instance, body, sign(SECRET, body));
    expect(res.statusCode).toBe(500);
    expect(recorded.released).toHaveLength(1);
    expect(recorded.released[0]).toContain("carrier:bosta");
  });
});
