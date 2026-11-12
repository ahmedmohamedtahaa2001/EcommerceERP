import { describe, expect, it } from "vitest";

import type {
  CancelShipmentRequest,
  CreateShipmentRequest,
  GetLabelRequest,
  GetStatusRequest,
  QuoteRateRequest,
  ShippingCarrier,
  WebhookParseResult,
} from "../src/shipping";

/**
 * A minimal in-memory adapter used to exercise the contract suite. Real
 * adapters (Bosta, Posta, J&T) plug in their own instance constructed
 * against the fake courier server (fixtures/courier) and must pass the same
 * assertions.
 */
class FakeShippingCarrier implements ShippingCarrier {
  readonly carrierCode = "fake";
  private readonly shipments = new Map<
    string,
    { tracking: string; status: "label_created" }
  >();

  capabilities() {
    return {
      cod: true,
      prepaid: true,
      labelFormats: ["pdf"],
      webhookSignature: "hmac-sha256" as const,
      cancellationSupported: true,
    };
  }

  async quoteRate(_req: QuoteRateRequest) {
    return [
      {
        carrier: this.carrierCode,
        serviceLevel: "standard",
        priceMinor: 5000,
        currency: "EGP",
      },
    ];
  }

  async createShipment(req: CreateShipmentRequest) {
    const id = `fake-${req.orderId}-${req.sequence}`;
    const tracking = `TRK-${req.orderId.slice(0, 8)}`;
    this.shipments.set(id, { tracking, status: "label_created" });
    return {
      carrierShipmentId: id,
      trackingNumber: tracking,
      status: "label_created" as const,
      labelUrl: `https://fake/labels/${id}.pdf`,
      raw: { id },
    };
  }

  async cancelShipment(req: { carrierShipmentId: string }) {
    this.shipments.delete(req.carrierShipmentId);
    return { cancelled: true, raw: {} };
  }

  async getLabel(req: GetLabelRequest) {
    return {
      contentType: "application/pdf",
      data: Buffer.from("fake-label"),
      url: `https://fake/labels/${req.carrierShipmentId}.pdf`,
      raw: {},
    };
  }

  async getStatus(req: GetStatusRequest) {
    const id = req.carrierShipmentId ?? "";
    const s = this.shipments.get(id);
    return {
      current: (s?.status ?? "label_created") as "label_created",
      events: [
        {
          carrierStatus: "label_created",
          status: "label_created" as const,
          occurredAt: new Date(),
          raw: {},
        },
      ],
      raw: {},
    };
  }

  async parseWebhook(
    _headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<WebhookParseResult> {
    const b = (body ?? {}) as Record<string, unknown>;
    return {
      eventId: String(b.eventId ?? "evt-1"),
      carrierShipmentId: b.shipmentId as string | undefined,
      trackingNumber: b.tracking as string | undefined,
      event: {
        carrierStatus: String(b.status ?? "delivered"),
        status: "delivered",
        occurredAt: new Date(),
        raw: body,
      },
      raw: body,
    };
  }
}

function makeCarrier(): ShippingCarrier {
  return new FakeShippingCarrier();
}

describe("ShippingCarrier contract", () => {
  it("capabilities() exposes the required fields", () => {
    const caps = makeCarrier().capabilities();
    expect(typeof caps.cod).toBe("boolean");
    expect(typeof caps.prepaid).toBe("boolean");
    expect(Array.isArray(caps.labelFormats)).toBe(true);
    expect(["hmac-sha256", "none"]).toContain(caps.webhookSignature);
    expect(typeof caps.cancellationSupported).toBe("boolean");
  });

  it("quoteRate() returns at least one quote with integer minor units", async () => {
    const quotes = await makeCarrier().quoteRate({
      destination: { line1: "x", governorateCode: "GZ" },
      items: [{ sku: "SKU1", quantity: 1 }],
    });
    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes.length).toBeGreaterThan(0);
    for (const q of quotes) {
      expect(Number.isInteger(q.priceMinor)).toBe(true);
      expect(q.currency).toHaveLength(3);
      expect(typeof q.serviceLevel).toBe("string");
    }
  });

  it("createShipment() returns ids, tracking number and an initial status", async () => {
    const res = await makeCarrier().createShipment({
      tenantId: "00000000-0000-4000-8000-000000000001",
      orderId: "00000000-0000-4000-8000-000000000002",
      sequence: 1,
      recipient: { phone: "+201012345678" },
      address: { line1: "x", governorateCode: "GZ" },
      items: [{ sku: "SKU1", quantity: 1 }],
      idempotencyKey: "key-1",
    });
    expect(typeof res.carrierShipmentId).toBe("string");
    expect(typeof res.trackingNumber).toBe("string");
    expect(typeof res.status).toBe("string");
    expect(res.raw).toBeDefined();
  });

  it("createShipment() is idempotent for the same (orderId, sequence)", async () => {
    const carrier = makeCarrier();
    const req: CreateShipmentRequest = {
      tenantId: "00000000-0000-4000-8000-000000000001",
      orderId: "00000000-0000-4000-8000-000000000003",
      sequence: 1,
      recipient: { phone: "+201012345678" },
      address: { line1: "x", governorateCode: "GZ" },
      items: [{ sku: "SKU1", quantity: 1 }],
      idempotencyKey: "key-2",
    };
    const a = await carrier.createShipment(req);
    const b = await carrier.createShipment(req);
    // Contract: a conforming adapter must not create a duplicate carrier
    // shipment for the same idempotency key. The fake returns the same id;
    // real adapters are verified against the fake courier's request count.
    expect(a.carrierShipmentId).toBe(b.carrierShipmentId);
  });

  it("cancelShipment() returns a cancelled flag", async () => {
    const carrier = makeCarrier();
    const created = await carrier.createShipment({
      tenantId: "00000000-0000-4000-8000-000000000001",
      orderId: "00000000-0000-4000-8000-000000000004",
      sequence: 1,
      recipient: { phone: "+201012345678" },
      address: { line1: "x", governorateCode: "GZ" },
      items: [{ sku: "SKU1", quantity: 1 }],
      idempotencyKey: "key-3",
    });
    const res = await carrier.cancelShipment({
      carrierShipmentId: created.carrierShipmentId,
    });
    expect(typeof res.cancelled).toBe("boolean");
  });

  it("getLabel() returns a content type and data", async () => {
    const carrier = makeCarrier();
    const created = await carrier.createShipment({
      tenantId: "00000000-0000-4000-8000-000000000001",
      orderId: "00000000-0000-4000-8000-000000000005",
      sequence: 1,
      recipient: { phone: "+201012345678" },
      address: { line1: "x", governorateCode: "GZ" },
      items: [{ sku: "SKU1", quantity: 1 }],
      idempotencyKey: "key-4",
    });
    const res = await carrier.getLabel({
      carrierShipmentId: created.carrierShipmentId,
    });
    expect(typeof res.contentType).toBe("string");
    expect(res.data).toBeDefined();
  });

  it("getStatus() returns a current status and an events array", async () => {
    const carrier = makeCarrier();
    const created = await carrier.createShipment({
      tenantId: "00000000-0000-4000-8000-000000000001",
      orderId: "00000000-0000-4000-8000-000000000006",
      sequence: 1,
      recipient: { phone: "+201012345678" },
      address: { line1: "x", governorateCode: "GZ" },
      items: [{ sku: "SKU1", quantity: 1 }],
      idempotencyKey: "key-5",
    });
    const res = await carrier.getStatus({
      carrierShipmentId: created.carrierShipmentId,
    });
    expect(typeof res.current).toBe("string");
    expect(Array.isArray(res.events)).toBe(true);
  });

  it("parseWebhook() returns an eventId and a normalized event", async () => {
    const res: WebhookParseResult = await makeCarrier().parseWebhook(
      { "x-signature": "abc" },
      { eventId: "evt-42", shipmentId: "shp-1", status: "delivered" },
    );
    expect(typeof res.eventId).toBe("string");
    expect(res.event).toBeDefined();
    expect(typeof res.event.status).toBe("string");
  });
});
