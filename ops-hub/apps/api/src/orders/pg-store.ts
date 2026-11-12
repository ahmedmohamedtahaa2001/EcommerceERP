import { randomUUID } from "node:crypto";

import { withTenant } from "@ops-hub/db";
import type { CreateOrderRequest } from "@ops-hub/contracts";
import type { Pool, PoolClient } from "pg";

import { allocateOrderNumber } from "./order-number";
import type {
  OrderLineRecord,
  OrderRecord,
  OrderStore,
  OrderWithDetails,
  PaymentRecord,
} from "./types";

interface OrderRow {
  id: string;
  tenant_id: string;
  order_number: string;
  customer_id: string;
  address_id: string | null;
  status: string;
  currency: string;
  channel: string;
  external_order_id: string | null;
  idempotency_key: string | null;
  idempotency_body_hash: string | null;
  created_at: Date;
  updated_at: Date;
}

interface OrderLineRow {
  id: string;
  tenant_id: string;
  order_id: string;
  variant_id: string;
  sku: string;
  quantity: number;
  unit_price_minor: number;
  currency: string;
}

interface PaymentRow {
  id: string;
  tenant_id: string;
  order_id: string;
  method: string;
  amount_minor: number;
  currency: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

function toOrder(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    addressId: row.address_id,
    status: row.status,
    currency: row.currency,
    channel: row.channel,
    externalOrderId: row.external_order_id,
    idempotencyKey: row.idempotency_key,
    idempotencyBodyHash: row.idempotency_body_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toLine(row: OrderLineRow): OrderLineRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    variantId: row.variant_id,
    sku: row.sku,
    quantity: row.quantity,
    unitPriceMinor: row.unit_price_minor,
    currency: row.currency,
  };
}

function toPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    method: row.method,
    amountMinor: row.amount_minor,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadDetails(
  client: PoolClient,
  tenantId: string,
  orderId: string,
): Promise<OrderWithDetails | null> {
  const orderResult = await client.query<OrderRow>(
    `select * from orders where tenant_id = $1 and id = $2`,
    [tenantId, orderId],
  );
  const orderRow = orderResult.rows[0];
  if (!orderRow) {
    return null;
  }
  const linesResult = await client.query<OrderLineRow>(
    `select * from order_lines where tenant_id = $1 and order_id = $2 order by id asc`,
    [tenantId, orderId],
  );
  const paymentResult = await client.query<PaymentRow>(
    `select * from payments where tenant_id = $1 and order_id = $2 limit 1`,
    [tenantId, orderId],
  );
  const paymentRow = paymentResult.rows[0];
  if (!paymentRow) {
    throw new Error(`order ${orderId} has no payment row`);
  }
  return {
    order: toOrder(orderRow),
    lines: linesResult.rows.map(toLine),
    payment: toPayment(paymentRow),
  };
}

export class PgOrderStore implements OrderStore {
  constructor(private readonly pool: Pool) {}

  async getByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<OrderWithDetails | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `select id from orders where tenant_id = $1 and idempotency_key = $2`,
        [tenantId, idempotencyKey],
      );
      const row = result.rows[0];
      return row ? loadDetails(client, tenantId, row.id) : null;
    });
  }

  async getById(
    tenantId: string,
    id: string,
  ): Promise<OrderWithDetails | null> {
    return withTenant(this.pool, tenantId, (client) =>
      loadDetails(client, tenantId, id),
    );
  }

  async createOrder(
    tenantId: string,
    request: CreateOrderRequest,
    idempotencyKey: string,
    idempotencyBodyHash: string,
    resolvedVariants: ReadonlyMap<string, { variantId: string }>,
    governorateCode: string | null,
  ): Promise<OrderWithDetails> {
    return withTenant(this.pool, tenantId, async (client) => {
      // Upsert the customer by (tenant, phone) — their identity key.
      const customerResult = await client.query<{ id: string }>(
        `insert into customers (id, tenant_id, phone, full_name)
         values ($1, $2, $3, $4)
         on conflict (tenant_id, phone) do update
           set full_name = coalesce(excluded.full_name, customers.full_name),
               updated_at = now()
         returning id`,
        [
          randomUUID(),
          tenantId,
          request.customer.phone,
          request.customer.fullName ?? null,
        ],
      );
      const customerId = customerResult.rows[0]!.id;

      const addressResult = await client.query<{ id: string }>(
        `insert into addresses
           (id, tenant_id, customer_id, line1, line2, city, governorate_code, raw_governorate)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning id`,
        [
          randomUUID(),
          tenantId,
          customerId,
          request.address.line1,
          request.address.line2 ?? null,
          request.address.city ?? null,
          governorateCode,
          request.address.governorate,
        ],
      );
      const addressId = addressResult.rows[0]!.id;

      const orderNumber = await allocateOrderNumber(client, tenantId);
      const orderId = randomUUID();

      await client.query(
        `insert into orders
           (id, tenant_id, order_number, customer_id, address_id, status, currency,
            channel, external_order_id, idempotency_key, idempotency_body_hash)
         values ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10)`,
        [
          orderId,
          tenantId,
          orderNumber,
          customerId,
          addressId,
          request.lines[0]!.currency,
          request.channel ?? "manual",
          request.externalOrderId ?? null,
          idempotencyKey,
          idempotencyBodyHash,
        ],
      );

      let totalMinor = 0;
      for (const line of request.lines) {
        const variant = resolvedVariants.get(line.sku);
        if (!variant) {
          throw new Error(`no resolved variant for sku ${line.sku}`);
        }
        totalMinor += line.unitPriceMinor * line.quantity;
        await client.query(
          `insert into order_lines
             (id, tenant_id, order_id, variant_id, sku, quantity, unit_price_minor, currency)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            randomUUID(),
            tenantId,
            orderId,
            variant.variantId,
            line.sku,
            line.quantity,
            line.unitPriceMinor,
            line.currency,
          ],
        );
      }

      await client.query(
        `insert into payments (id, tenant_id, order_id, method, amount_minor, currency, status)
         values ($1, $2, $3, $4, $5, $6, 'pending')`,
        [
          randomUUID(),
          tenantId,
          orderId,
          request.payment.method,
          totalMinor,
          request.lines[0]!.currency,
        ],
      );

      const details = await loadDetails(client, tenantId, orderId);
      if (!details) {
        throw new Error("order was just created but could not be re-read");
      }
      return details;
    });
  }
}
