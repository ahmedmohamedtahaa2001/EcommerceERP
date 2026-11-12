import type { FastifyInstance } from "fastify";

import { verifyShopifyHmac, mapShopifyOrder } from "./inbound";
import type { OrderService } from "../../orders/service";

import { recordAudit } from "../../audit/record";
import type { AuditWriter } from "../../audit/types";

export function registerShopifyRoutes(
  app: FastifyInstance,
  options: {
    orders: OrderService;
    webhookSecret: string;
    tenantId: string;
    audit?: AuditWriter;
  },
): void {
  const { orders, webhookSecret, tenantId, audit } = options;

  app.post("/v1/webhooks/shopify/orders", async (request, reply) => {
    const raw = JSON.stringify(request.body ?? {});
    const sig = request.headers["x-shopify-hmac-sha256"] as string | undefined;
    if (sig && !verifyShopifyHmac(webhookSecret, raw, sig)) {
      reply.status(401);
      return { error: "invalid signature" };
    }
    const payload = request.body as Record<string, unknown>;
    const mapped = mapShopifyOrder(
      payload as unknown as Parameters<typeof mapShopifyOrder>[0],
    );
    try {
      const result = await orders.createOrder(
        tenantId,
        `shopify-${String(payload.id)}`,
        {
          customer: mapped.customer,
          address: mapped.address,
          lines: mapped.lines,
          payment: mapped.payment,
          channel: mapped.channel,
          externalOrderId: mapped.externalOrderId,
        },
      );
      if (audit) {
        await recordAudit(request, audit, {
          action: "shopify.order_received",
          objectType: "order",
          objectId: result.result.order.id,
          after: result.result,
        });
      }
      reply.status(201);
      return { ok: true, orderId: result.result.order.id };
    } catch (e) {
      reply.status(400);
      return { error: String(e) };
    }
  });
}
