import type { FastifyInstance } from "fastify";

import type { ShippingCarrier } from "@ops-hub/integrations";
import type { ShipmentService } from "./service";

const seen = new Set<string>();

export function registerShipmentWebhookRoutes(
  app: FastifyInstance,
  options: {
    carriers: Record<string, ShippingCarrier>;
    shipments: ShipmentService;
    webhookSecret?: string;
  },
): void {
  const { carriers, webhookSecret } = options;

  app.post("/v1/webhooks/carriers/:carrier", async (request, reply) => {
    const { carrier } = request.params as { carrier: string };
    const adapter = carriers[carrier];
    if (!adapter) {
      reply.status(404);
      return { error: "unknown carrier" };
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

    void webhookSecret;
    return;
  });
}
