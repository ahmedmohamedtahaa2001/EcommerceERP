import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export interface KpiValue {
  metric: string;
  value: number;
  /** Human unit so a dashboard can render it without a lookup. */
  unit: "count" | "percent" | "minor" | "hours";
}

/**
 * The KPI service (roadmap P3-S12-T06). Every metric's formula is
 * documented in `docs/kpis.md`; this list and that document must stay in
 * sync, and `apps/api/tests/kpis.test.ts` checks that they do.
 */
export class KpiService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
    },
  ) {}

  /** Computes the KPI set for a day. */
  async compute(tenantId: string, date: Date): Promise<KpiValue[]> {
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

    return withTenant(this.deps.pool, tenantId, async (client) => {
      const values: KpiValue[] = [];
      const push = (
        metric: string,
        value: number,
        unit: KpiValue["unit"],
      ): void => {
        values.push({ metric, value, unit });
      };

      // ---- Orders -----------------------------------------------------------
      const orders = await client.query<{ count: string }>(
        `select count(*)::text as count from orders
          where tenant_id=$1 and created_at >= $2 and created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      push("orders_created", Number(orders.rows[0]?.count ?? 0), "count");

      const cycle = await client.query<{ hours: string }>(
        `select coalesce(avg(extract(epoch from (coalesce(s.updated_at, now()) - o.created_at))/3600),0)::text as hours
           from orders o left join shipments s on s.order_id=o.id and s.tenant_id=o.tenant_id
          where o.tenant_id=$1 and o.created_at >= $2 and o.created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      push(
        "order_cycle_time_hours",
        Math.round(Number(cycle.rows[0]?.hours ?? 0)),
        "hours",
      );

      const confirmed = await client.query<{ count: string }>(
        `select count(*)::text as count from orders
          where tenant_id=$1 and status in ('validated','confirmed','allocated','shipped','delivered')
            and created_at >= $2 and created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      push("orders_confirmed", Number(confirmed.rows[0]?.count ?? 0), "count");

      // ---- Inventory --------------------------------------------------------
      const oversold = await client.query<{ count: string }>(
        `select count(*)::text as count from stock_balances
          where tenant_id=$1 and bucket='on_hand' and quantity < 0`,
        [tenantId],
      );
      push("oversold_skus", Number(oversold.rows[0]?.count ?? 0), "count");

      const accuracy = await client.query<{
        variance: string;
        movements: string;
      }>(
        `select coalesce(sum(abs(coalesce((select sum(sb.quantity) from stock_balances sb
                where sb.tenant_id=m.tenant_id and sb.variant_id=m.variant_id
                  and sb.location_id=m.location_id and sb.bucket='on_hand'),0))),0)::text as variance,
                count(*)::text as movements
           from stock_movements m where m.tenant_id=$1`,
        [tenantId],
      );
      const variance = Number(accuracy.rows[0]?.variance ?? 0);
      const movements = Number(accuracy.rows[0]?.movements ?? 0);
      push(
        "inventory_accuracy_percent",
        movements === 0
          ? 100
          : Math.max(0, 100 - Math.round((variance / movements) * 100)),
        "percent",
      );

      // Dock-to-stock: time from receiving a line to releasing it into a bin.
      const dock = await client.query<{ hours: string }>(
        `select coalesce(avg(extract(epoch from (r.released_at - r.received_at))/3600),0)::text as hours
           from receipts r
          where r.tenant_id=$1 and r.released_at is not null
            and r.received_at >= $2 and r.received_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      push(
        "dock_to_stock_hours",
        Math.round(Number(dock.rows[0]?.hours ?? 0)),
        "hours",
      );

      // ---- Shipping ---------------------------------------------------------
      const delivered = await client.query<{ count: string }>(
        `select count(*)::text as count from shipments
          where tenant_id=$1 and status='delivered'
            and created_at >= $2 and created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      push(
        "shipments_delivered",
        Number(delivered.rows[0]?.count ?? 0),
        "count",
      );

      const shipped = await client.query<{ count: string }>(
        `select count(*)::text as count from shipments
          where tenant_id=$1 and status in ('shipped','in_transit','delivered')
            and created_at >= $2 and created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      const shippedCount = Number(shipped.rows[0]?.count ?? 0);
      const onTime = await client.query<{ count: string }>(
        `select count(*)::text as count from shipments
          where tenant_id=$1 and status='delivered'
            and created_at >= $2 and created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      const deliveredCount = Number(onTime.rows[0]?.count ?? 0);
      push(
        "shipping_on_time_percent",
        deliveredCount === 0
          ? 100
          : Math.round((deliveredCount / Math.max(1, shippedCount)) * 100),
        "percent",
      );

      const gaps = await client.query<{ count: string }>(
        `select count(*)::text as count from exceptions
          where tenant_id=$1 and reason_code='SCAN_GAP' and status='open'`,
        [tenantId],
      );
      push("scan_gap_open", Number(gaps.rows[0]?.count ?? 0), "count");

      const wismo = await client.query<{ count: string }>(
        `select count(*)::text as count from tickets
          where tenant_id=$1 and type='wismo' and created_at >= $2 and created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      push("wismo_tickets", Number(wismo.rows[0]?.count ?? 0), "count");

      // ---- COD --------------------------------------------------------------
      const cod = await client.query<{ expected: string; collected: string }>(
        `select coalesce(sum(p.amount_minor),0)::text as expected,
                coalesce(sum(p.amount_minor) filter (where p.status='collected'),0)::text as collected
           from payments p join orders o on o.id=p.order_id
          where p.tenant_id=$1 and p.method='cod'
            and o.created_at >= $2 and o.created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      const expected = Number(cod.rows[0]?.expected ?? 0);
      const collected = Number(cod.rows[0]?.collected ?? 0);
      push("cod_expected_minor", expected, "minor");
      push("cod_collected_minor", collected, "minor");
      push(
        "cod_collection_rate_percent",
        expected === 0 ? 100 : Math.round((collected / expected) * 100),
        "percent",
      );

      const unmatched = await client.query<{ total: string; amount: string }>(
        `select count(*)::text as total,
                coalesce(sum(sl.amount_minor),0)::text as amount
           from settlement_lines sl join settlement_files f on f.id=sl.file_id
          where sl.tenant_id=$1 and sl.order_id is null
            and f.imported_at >= $2 and f.imported_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      push(
        "cod_unmatched_lines",
        Number(unmatched.rows[0]?.total ?? 0),
        "count",
      );
      push(
        "cod_unmatched_minor",
        Number(unmatched.rows[0]?.amount ?? 0),
        "minor",
      );

      // ---- Support ----------------------------------------------------------
      const firstResponse = await client.query<{ hours: string }>(
        `select coalesce(avg(extract(epoch from (m.created_at - t.created_at))/3600),0)::text as hours
           from ticket_messages m join tickets t on t.id=m.ticket_id and t.tenant_id=m.tenant_id
          where m.tenant_id=$1 and m.direction='inbound'
            and t.created_at >= $2 and t.created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      push(
        "support_first_response_hours",
        Math.round(Number(firstResponse.rows[0]?.hours ?? 0)),
        "hours",
      );

      const resolution = await client.query<{ hours: string }>(
        `select coalesce(avg(extract(epoch from (t.resolved_at - t.created_at))/3600),0)::text as hours
           from tickets t
          where t.tenant_id=$1 and t.resolved_at is not null
            and t.created_at >= $2 and t.created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      push(
        "support_resolution_hours",
        Math.round(Number(resolution.rows[0]?.hours ?? 0)),
        "hours",
      );

      // ---- CRM --------------------------------------------------------------
      const repeat = await client.query<{
        customers: string;
        repeated: string;
      }>(
        `select count(*)::text as customers,
                count(*) filter (where orders > 1)::text as repeated
           from (select c.id, count(o.id) as orders
                   from customers c left join orders o on o.customer_id=c.id and o.tenant_id=c.tenant_id
                  where c.tenant_id=$1 group by c.id) t`,
        [tenantId],
      );
      const customers = Number(repeat.rows[0]?.customers ?? 0);
      push(
        "crm_repeat_rate_percent",
        customers === 0
          ? 0
          : Math.round(
              (Number(repeat.rows[0]?.repeated ?? 0) / customers) * 100,
            ),
        "percent",
      );

      const unsubscribe = await client.query<{ count: string }>(
        `select count(*)::text as count from consents
          where tenant_id=$1 and purpose='marketing' and not granted`,
        [tenantId],
      );
      push(
        "crm_unsubscribed",
        Number(unsubscribe.rows[0]?.count ?? 0),
        "count",
      );

      // ---- Exceptions -------------------------------------------------------
      const exceptions = await client.query<{ count: string }>(
        `select count(*)::text as count from exceptions
          where tenant_id=$1 and status='open'`,
        [tenantId],
      );
      push("open_exceptions", Number(exceptions.rows[0]?.count ?? 0), "count");

      return values;
    });
  }

  /** One metric, by name. Used by `GET /v1/kpis?metric=…`. */
  async one(
    tenantId: string,
    metric: string,
    date: Date,
  ): Promise<KpiValue | null> {
    const all = await this.compute(tenantId, date);
    return all.find((k) => k.metric === metric) ?? null;
  }
}
