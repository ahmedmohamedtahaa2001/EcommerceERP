import type { FastifyInstance } from "fastify";

import { Pool } from "pg";

export function registerTrackingRoutes(
  app: FastifyInstance,
  options: { pool: Pool },
): void {
  const { pool } = options;

  app.get("/v1/track", async (request, reply) => {
    const q = request.query as { order?: string; phone?: string };
    const orderRef = q.order;
    const phone = q.phone;
    if (!orderRef || !phone) {
      reply.status(404);
      return { error: "not found" };
    }

    // Normalize phone loosely: strip non-digits, ensure +20.
    const digits = phone.replace(/\D/g, "");
    const normalized = digits.startsWith("20")
      ? `+${digits}`
      : `+20${digits.replace(/^0/, "")}`;

    // Look up order by order_number across tenants is not allowed (RLS).
    // For the public tracking page we do an unscoped lookup by order_number
    // and then verify the customer phone matches.
    const client = await pool.connect();
    try {
      const r = await client.query<{
        id: string;
        tenant_id: string;
        status: string;
        order_number: string;
        customer_phone: string;
      }>(
        `select o.id, o.tenant_id, o.status, o.order_number, c.phone as customer_phone
         from orders o join customers c on c.id = o.customer_id
         where o.order_number = $1`,
        [orderRef],
      );
      const row = r.rows[0];
      if (!row || row.customer_phone !== normalized) {
        reply.status(404);
        return { error: "not found" };
      }
      return {
        orderNumber: row.order_number,
        status: row.status,
      };
    } finally {
      client.release();
    }
  });
}
