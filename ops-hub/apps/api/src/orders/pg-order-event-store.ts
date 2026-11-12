import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type { OrderEventRecord, OrderEventStore } from "./types";

interface OrderEventRow {
  id: string;
  tenant_id: string;
  order_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  customer_visible: boolean;
  actor_type: string | null;
  actor_id: string | null;
  created_at: Date;
}

function toRecord(row: OrderEventRow): OrderEventRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note,
    customerVisible: row.customer_visible,
    actorType: row.actor_type,
    actorId: row.actor_id,
    createdAt: row.created_at,
  };
}

export class PgOrderEventStore implements OrderEventStore {
  constructor(private readonly pool: Pool) {}

  async list(
    tenantId: string,
    orderId: string,
    filter: { customerVisible?: boolean },
  ): Promise<OrderEventRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1", "order_id = $2"];
      const params: unknown[] = [tenantId, orderId];
      if (filter.customerVisible !== undefined) {
        params.push(filter.customerVisible);
        conditions.push(`customer_visible = $${params.length}`);
      }
      const result = await client.query<OrderEventRow>(
        `select * from order_events where ${conditions.join(" and ")}
          order by created_at asc, id asc`,
        params,
      );
      return result.rows.map(toRecord);
    });
  }

  async addNote(
    tenantId: string,
    orderId: string,
    note: string,
    customerVisible: boolean,
    actor: { type: "user" | "api_key"; id: string } | null,
  ): Promise<OrderEventRecord> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<OrderEventRow>(
        `insert into order_events
           (tenant_id, order_id, event_type, note, customer_visible, actor_type, actor_id)
         values ($1, $2, 'note', $3, $4, $5, $6)
         returning *`,
        [
          tenantId,
          orderId,
          note,
          customerVisible,
          actor?.type ?? null,
          actor?.id ?? null,
        ],
      );
      return toRecord(result.rows[0]!);
    });
  }
}
