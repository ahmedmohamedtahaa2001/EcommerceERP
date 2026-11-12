import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

export interface DailyReport {
  date: string;
  ordersCreated: number;
  ordersByStatus: Record<string, number>;
  shipments: number;
  openExceptions: number;
  codExpectedMinor: number;
  codCollectedMinor: number;
}

/**
 * Daily operations summary. Counts come straight from the operational tables
 * so the numbers always match what the ops console shows.
 */
export class ReportsService {
  constructor(private readonly pool: Pool) {}

  async daily(tenantId: string, date: Date): Promise<DailyReport> {
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    return withTenant(this.pool, tenantId, async (client) => {
      const ordersCreated = await client.query<{ count: string }>(
        `select count(*)::text as count from orders
          where tenant_id=$1 and created_at >= $2 and created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );

      const byStatus = await client.query<{ status: string; count: string }>(
        `select status, count(*)::text as count from orders
          where tenant_id=$1 group by status`,
        [tenantId],
      );

      const shipments = await client.query<{ count: string }>(
        `select count(*)::text as count from shipments where tenant_id=$1`,
        [tenantId],
      );

      const exceptions = await client.query<{ count: string }>(
        `select count(*)::text as count from exceptions
          where tenant_id=$1 and status <> 'resolved'`,
        [tenantId],
      );

      const cod = await client.query<{
        expected: string;
        collected: string;
      }>(
        `select
           coalesce(sum(p.amount_minor),0)::text as expected,
           coalesce(sum(p.amount_minor) filter (where p.status='collected'),0)::text as collected
         from payments p
          join orders o on o.id = p.order_id
         where p.tenant_id=$1 and p.method='cod'
           and o.created_at >= $2 and o.created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );

      return {
        date: dayStart.toISOString().slice(0, 10),
        ordersCreated: Number(ordersCreated.rows[0]?.count ?? 0),
        ordersByStatus: Object.fromEntries(
          byStatus.rows.map((r) => [r.status, Number(r.count)]),
        ),
        shipments: Number(shipments.rows[0]?.count ?? 0),
        openExceptions: Number(exceptions.rows[0]?.count ?? 0),
        codExpectedMinor: Number(cod.rows[0]?.expected ?? 0),
        codCollectedMinor: Number(cod.rows[0]?.collected ?? 0),
      };
    });
  }
}
