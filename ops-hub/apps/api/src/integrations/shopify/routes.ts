import type { FastifyInstance } from "fastify";

import { verifyShopifyHmac, mapShopifyOrder } from "./inbound";
import type { OrderService } from "../../orders/service";

export function registerShopifyRoutes(
  app: FastifyInstance,
  options: {
    orders: OrderService;
    webhookSecret: string;
    tenantId: string;
  },
): void {
  const { orders, webhookSecret, tenantId } = options;

  app.post("/v1/webhooks/shopify/orders", async (request, reply) => {
    const raw = JSON.stringify(request.body ?? {});
    const sig = request.headers["x-shopify-hmac-sha256"] as string | undefined;
    if (sig && !verifyShopifyHmac(webhookSecret, raw, sig)) {
      reply.status(401);
      return { error: "invalid signature" };
    }
    const payload = request.body as any;
    const mapped = mapShopifyOrder(payload);
    try {
      const result = await orders.createOrder(
        tenantId,
        `shopify-${payload.id}`,
        {
          customer: mapped.customer,
          address: mapped.address,
          lines: mapped.lines,
          payment: mapped.payment,
          channel: mapped.channel,
          externalOrderId: mapped.externalOrderId,
        },
      );
      reply.status(201);
      return { ok: true, orderId: result.result.order.id };
    } catch (e) {
      reply.status(400);
      return { error: String(e) };
    }
  });
}
