import type { FastifyInstance } from "fastify";

import type { ShippingCarrier } from "@ops-hub/integrations";
import type { ShipmentService } from "./service";
import {
  CARRIER_SIGNATURE_HEADER,
  verifyCarrierSignature,
} from "./webhook-signature";

const seen = new Set<string>();

export function registerShipmentWebhookRoutes(
  app: FastifyInstance,
  options: {
    carriers: Record<string, ShippingCarrier>;
    shipments: ShipmentService;
    /** Keyed by carrier code. A carrier without a secret rejects every call. */
    webhookSecrets: Record<string, string | undefined>;
  },
): void {
  const { carriers, webhookSecrets } = options;

  app.post("/v1/webhooks/carriers/:carrier", async (request, reply) => {
    const { carrier } = request.params as { carrier: string };
    const adapter = carriers[carrier];
    if (!adapter) {
      reply.status(404);
      return { error: "unknown carrier" };
    }

    const signature = request.headers[CARRIER_SIGNATURE_HEADER];
    if (
      !verifyCarrierSignature(
        webhookSecrets[carrier],
        request.rawBody,
        typeof signature === "string" ? signature : undefined,
      )
    ) {
      reply.status(401);
      return { error: "invalid signature" };
    }

    const headers = request.headers as Record<
      string,
      string | string[] | undefined
    >;
    const body = request.body;

    let parsed;
    try {
      parsed = await adapter.parseWebhook(headers, body);
    } catch {
      reply.status(400);
      return { error: "parse failed" };
    }

    const dedupKey = `${carrier}:${parsed.eventId}`;
    if (seen.has(dedupKey)) {
      reply.status(200);
      return { ok: true, duplicate: true };
    }
    seen.add(dedupKey);

    reply.status(200);
    reply.send({ ok: true });
    return;
  });
}
