import { createHash } from "node:crypto";

import type { FastifyInstance } from "fastify";

import type { ShippingCarrier } from "@ops-hub/integrations";
import type { ShipmentService } from "./service";
import type { StatusMapping } from "./normalize";
import {
  CARRIER_SIGNATURE_HEADER,
  verifyCarrierSignature,
} from "./webhook-signature";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ProcessedEvents {
  /** True when this call claimed the event; false when it was already processed. */
  tryMarkProcessed(
    tenantId: string,
    consumer: string,
    eventId: string,
  ): Promise<boolean>;
  /** Gives the claim back so a failed attempt can be retried by the carrier. */
  release(tenantId: string, consumer: string, eventId: string): Promise<void>;
}

/** Carrier event ids are not guaranteed to be UUIDs; a stable UUID derived from them fits the durable store. */
export function carrierEventKey(carrier: string, eventId: string): string {
  const hex = createHash("sha256")
    .update(`${carrier}:${eventId}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function registerShipmentWebhookRoutes(
  app: FastifyInstance,
  options: {
    carriers: Record<string, ShippingCarrier>;
    shipments: ShipmentService;
    processed: ProcessedEvents;
    /** Carrier status text to ours. A carrier with no mapping is recorded as unmapped, never guessed. */
    mappings: Record<string, StatusMapping>;
    /** Keyed by carrier code. A carrier without a secret rejects every call. */
    webhookSecrets: Record<string, string | undefined>;
  },
): void {
  const { carriers, shipments, processed, mappings, webhookSecrets } = options;

  app.post(
    "/v1/webhooks/carriers/:carrier/:tenantId",
    async (request, reply) => {
      const { carrier, tenantId } = request.params as {
        carrier: string;
        tenantId: string;
      };
      const adapter = carriers[carrier];
      if (!adapter || !UUID_PATTERN.test(tenantId)) {
        reply.status(404);
        return { error: "unknown carrier or business" };
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
      let parsed;
      try {
        parsed = await adapter.parseWebhook(headers, request.body);
      } catch {
        reply.status(400);
        return { error: "parse failed" };
      }

      const trackingNumber = parsed.trackingNumber;
      if (!trackingNumber) {
        reply.status(422);
        return { error: "tracking number is required" };
      }

      const shipment = await shipments.findByTrackingNumber(
        tenantId,
        trackingNumber,
      );
      if (!shipment) {
        // Acknowledge so the carrier stops retrying a shipment we never created.
        return { ok: true, matched: false };
      }

      const isNew = await processed.tryMarkProcessed(
        tenantId,
        `carrier:${carrier}`,
        carrierEventKey(carrier, parsed.eventId),
      );
      if (!isNew) {
        return { ok: true, duplicate: true };
      }

      const consumer = `carrier:${carrier}`;
      const eventKey = carrierEventKey(carrier, parsed.eventId);
      try {
        const result = await shipments.applyCarrierStatus(
          tenantId,
          shipment.id,
          parsed.event.carrierStatus,
          mappings[carrier] ?? {},
          parsed.event.occurredAt,
        );
        return {
          ok: true,
          matched: true,
          status: result.status,
          unmapped: result.unmapped,
        };
      } catch (error) {
        await processed.release(tenantId, consumer, eventKey);
        throw error;
      }
    },
  );
}
