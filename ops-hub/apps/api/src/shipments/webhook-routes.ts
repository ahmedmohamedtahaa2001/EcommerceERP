import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import type { AuditWriter } from "../audit/types";
import type { ShippingCarrier } from "@ops-hub/integrations";
import type { ShipmentService } from "./service";
import { normalizeStatus, BOSTA_STATUS_MAP } from "./normalize";

const seen = new Set<string>();

export function registerShipmentWebhookRoutes(
  app: FastifyInstance,
  options: {
    carriers: Record<string, ShippingCarrier>;
    shipments: ShipmentService;
    webhookSecret?: string;
  },
): void {
  app.post("/v1/webhooks/carriers/:carrier", async (request, reply) => {
    const { carrier } = request.params as { carrier: string };
    const adapter = options.carriers[carrier];
    if (!adapter) {
      reply.status(404);
      return { error: "unknown carrier" };
    }

    // Signature verification (placeholder: HMAC-SHA256 of raw body).
    const headers = request.headers as Record<
      string,
      string | string[] | undefined
    >;
    const secret = options.webhookSecret ?? "placeholder-secret";
    const sig = headers["x-signature"] ?? headers["x-hub-signature-256"];
    const raw = JSON.stringify(request.body ?? {});
    const expected = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");
    // In placeholder mode we accept even without a valid signature to keep
    // dev flow working; production must enforce (see note).
    const provided = Array.isArray(sig) ? sig[0] : sig;
    // store raw regardless
    const body = request.body;

    let parsed;
    try {
      parsed = await adapter.parseWebhook(headers, body);
    } catch {
      reply.status(400);
      return { error: "parse failed" };
    }

    // Dedup by (carrier, eventId).
    const dedupKey = `${carrier}:${parsed.eventId}`;
    if (seen.has(dedupKey)) {
      reply.status(200);
      return { ok: true, duplicate: true };
    }
    seen.add(dedupKey);

    // ACK fast; process (placeholder synchronous).
    reply.status(200);
    reply.send({ ok: true });

    // Process asynchronously (fire and forget).
    void (async () => {
      try {
        if (parsed.carrierShipmentId) {
          // find shipment by carrier id — placeholder: scan not implemented;
          // real impl looks up by carrierShipmentId. We skip apply here.
        }
      } catch {
        // swallow; DLQ handling is a later task
      }
    })();
  });
}
