import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export class PlaybookError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "PlaybookError";
    this.statusCode = statusCode;
  }
}

export interface PlaybookResult {
  playbook: string;
  output: Record<string, unknown>;
}

/**
 * Agent playbooks (roadmap Sprint 15): recurring jobs that read operational
 * data and produce a report, a triage list or a settlement analysis. A
 * playbook never writes to the business: it only produces output.
 */
export class PlaybookService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
    },
  ) {}

  /** Morning report: yesterday's orders, COD collected, shipments, RTO and
   * open exceptions. */
  async morningReport(tenantId: string, date: Date): Promise<PlaybookResult> {
    const dayStart = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() - 1,
      ),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

    const output = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const orders = await client.query<{ count: string }>(
          `select count(*)::text as count from orders
          where tenant_id=$1 and created_at >= $2 and created_at < $3`,
          [tenantId, dayStart, dayEnd],
        );
        const shipments = await client.query<{ count: string }>(
          `select count(*)::text as count from shipments
          where tenant_id=$1 and created_at >= $2 and created_at < $3`,
          [tenantId, dayStart, dayEnd],
        );
        const rto = await client.query<{ count: string }>(
          `select count(*)::text as count from shipments
          where tenant_id=$1 and status='returned_to_sender'`,
          [tenantId],
        );
        const cod = await client.query<{ expected: string; collected: string }>(
          `select coalesce(sum(p.amount_minor),0)::text as expected,
                coalesce(sum(p.amount_minor) filter (where p.status='collected'),0)::text as collected
           from payments p join orders o on o.id=p.order_id
          where p.tenant_id=$1 and p.method='cod'
            and o.created_at >= $2 and o.created_at < $3`,
          [tenantId, dayStart, dayEnd],
        );
        const exceptions = await client.query<{ count: string }>(
          `select count(*)::text as count from exceptions
          where tenant_id=$1 and status='open'`,
          [tenantId],
        );
        const expected = Number(cod.rows[0]?.expected ?? 0);
        const collected = Number(cod.rows[0]?.collected ?? 0);
        return {
          date: dayStart.toISOString().slice(0, 10),
          ordersCreated: Number(orders.rows[0]?.count ?? 0),
          shipmentsCreated: Number(shipments.rows[0]?.count ?? 0),
          returnedToSender: Number(rto.rows[0]?.count ?? 0),
          openExceptions: Number(exceptions.rows[0]?.count ?? 0),
          codExpectedMinor: expected,
          codCollectedMinor: collected,
          codCollectionRate:
            expected === 0 ? 100 : Math.round((collected / expected) * 100),
        };
      },
    );
    return { playbook: "morning_report", output };
  }

  /** Exception triage: group open exceptions by reason and suggest the next
   * action. Suggestions never execute writes. */
  async exceptionTriage(tenantId: string): Promise<PlaybookResult> {
    const output = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const rows = await client.query<{
          reason_code: string;
          count: string;
          oldest: Date;
        }>(
          `select reason_code, count(*)::text as count, min(created_at) as oldest
           from exceptions where tenant_id=$1 and status='open'
          group by reason_code order by count(*) desc`,
          [tenantId],
        );
        const groups = rows.rows.map((row) => ({
          reasonCode: row.reason_code,
          count: Number(row.count),
          oldestAt: row.oldest,
          suggestedAction: suggestAction(row.reason_code),
        }));
        return {
          groups,
          totalOpen: groups.reduce((sum, g) => sum + g.count, 0),
        };
      },
    );
    return { playbook: "exception_triage", output };
  }

  /** COD settlement analysis: matched and unmatched totals plus the top
   * candidate orders for the unmatched lines. */
  async settlementAnalysis(
    tenantId: string,
    fileId: string,
  ): Promise<PlaybookResult> {
    const output = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const file = await client.query<{
          carrier: string;
          line_count: number;
        }>(
          `select carrier, line_count from settlement_files where tenant_id=$1 and id=$2`,
          [tenantId, fileId],
        );
        if (!file.rows[0])
          throw new PlaybookError("Settlement file not found.", 404);
        const lines = await client.query<{
          total: string;
          unmatched: string;
          unmatched_amount: string;
        }>(
          `select count(*)::text as total,
                count(*) filter (where order_id is null)::text as unmatched,
                coalesce(sum(amount_minor) filter (where order_id is null),0)::text as unmatched_amount
           from settlement_lines where tenant_id=$1 and file_id=$2`,
          [tenantId, fileId],
        );
        const candidates = await client.query<{
          id: string;
          order_number: string;
          status: string;
        }>(
          `select o.id, o.order_number, o.status
           from orders o
          where o.tenant_id=$1 and o.id not in (
            select order_id from settlement_lines
             where tenant_id=$1 and file_id=$2 and order_id is not null)
          order by o.created_at desc limit 5`,
          [tenantId, fileId],
        );
        const l = lines.rows[0]!;
        return {
          carrier: file.rows[0].carrier,
          fileId,
          totalLines: Number(l.total),
          matched: Number(l.total) - Number(l.unmatched),
          unmatched: Number(l.unmatched),
          unmatchedAmountMinor: Number(l.unmatched_amount),
          candidateOrders: candidates.rows.map((row) => ({
            orderId: row.id,
            orderNumber: row.order_number,
            status: row.status,
          })),
        };
      },
    );
    return { playbook: "settlement_analysis", output };
  }

  /** Drafts a customer reply and stores it as an internal note; it is never
   * sent. */
  async draftReply(
    tenantId: string,
    orderId: string,
    message: string,
  ): Promise<PlaybookResult> {
    await withTenant(this.deps.pool, tenantId, async (client) => {
      const ticket = await client.query<{ id: string }>(
        `select id from tickets where tenant_id=$1 and order_id=$2 limit 1`,
        [tenantId, orderId],
      );
      if (ticket.rows[0]) {
        await client.query(
          `insert into ticket_messages (tenant_id, ticket_id, channel, direction, body, internal)
           values ($1,$2,'playbook','outbound',$3,true)`,
          [tenantId, ticket.rows[0].id, message],
        );
      } else {
        await client.query(
          `insert into order_events
             (tenant_id, order_id, event_type, note, customer_visible, actor_type)
           values ($1,$2,'note',$3,false,'playbook')`,
          [tenantId, orderId, message],
        );
      }
    });
    return {
      playbook: "draft_reply",
      output: { orderId, draft: message, status: "pending" },
    };
  }
}

function suggestAction(reasonCode: string): string {
  switch (reasonCode) {
    case "DUPLICATE_SUSPECTED":
      return "Review the suspected duplicate and accept or merge it";
    case "INSUFFICIENT_STOCK":
      return "Restock the SKU or release the reservation";
    case "ADDRESS_INCOMPLETE":
      return "Ask the customer to confirm the address";
    case "PAYMENT_METHOD_NOT_ALLOWED":
      return "Convert the order to an allowed payment method";
    case "SCAN_GAP":
      return "Check the shipment with the carrier";
    case "UNMAPPED_CARRIER_STATUS":
      return "Map the carrier status and replay the event";
    default:
      return "Review the exception manually";
  }
}
