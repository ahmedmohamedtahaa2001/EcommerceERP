import { createHmac, randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { ShippingCarrier } from "@ops-hub/integrations";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import type { ShipmentService } from "../src/shipments/service";
import { FakeAuditWriter } from "./fakes";

const SECRET = "bosta-test-secret";
const ROUTE = "/v1/webhooks/carriers/bosta";

const fakeBosta = {
  parseWebhook: async (_headers: unknown, body: unknown) => ({
    eventId: String((body as { eventId: string }).eventId),
    event: {
      carrierStatus: "delivered",
      status: "delivered",
      occurredAt: new Date(),
      raw: body,
    },
    raw: body,
  }),
} as unknown as ShippingCarrier;

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function build(secrets: Record<string, string | undefined>): FastifyInstance {
  app = buildApp({
    logger: false,
    shipments: {} as ShipmentService,
    audit: new FakeAuditWriter(),
    carriers: { bosta: fakeBosta },
    carrierWebhookSecrets: secrets,
  });
  return app;
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

function freshBody(): string {
  return JSON.stringify({
    eventId: `evt-${randomUUID()}`,
    shipmentId: "SHIP-1",
    status: "delivered",
  });
}

describe("carrier webhook signature verification", () => {
  it("accepts a correctly signed payload", async () => {
    const instance = build({ bosta: SECRET });
    const body = freshBody();
    const res = await post(instance, body, sign(SECRET, body));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const instance = build({ bosta: SECRET });
    const body = freshBody();
    const res = await post(instance, body, sign("wrong-secret", body));
    expect(res.statusCode).toBe(401);
  });

  it("rejects a valid signature replayed against a modified body", async () => {
    const instance = build({ bosta: SECRET });
    const body = freshBody();
    const tampered = body.replace("delivered", "returned");
    const res = await post(instance, tampered, sign(SECRET, body));
    expect(res.statusCode).toBe(401);
  });

  it("rejects a request with no signature header", async () => {
    const instance = build({ bosta: SECRET });
    const res = await post(instance, freshBody(), undefined);
    expect(res.statusCode).toBe(401);
  });

  it("fails closed when the carrier has no secret configured", async () => {
    const instance = build({});
    const body = freshBody();
    const res = await post(instance, body, sign(SECRET, body));
    expect(res.statusCode).toBe(401);
  });

  it("still returns 404 for an unknown carrier before checking signatures", async () => {
    const instance = build({ bosta: SECRET });
    const res = await post(
      instance,
      freshBody(),
      "anything",
      "/v1/webhooks/carriers/nope",
    );
    expect(res.statusCode).toBe(404);
  });
});
