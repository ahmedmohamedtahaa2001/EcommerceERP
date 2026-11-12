import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";
import { normalizePhone } from "@ops-hub/shared";

export type TicketPriority = "critical" | "high" | "normal" | "low";

export class InboxError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "InboxError";
    this.statusCode = statusCode;
  }
}

/** SLA targets in hours, per priority. */
export const SLA_HOURS: Record<TicketPriority, number> = {
  critical: 1,
  high: 4,
  normal: 24,
  low: 72,
};

/** Priority derived from the ticket type. */
export function priorityForType(type: string): TicketPriority {
  switch (type) {
    case "complaint":
    case "refund_request":
      return "high";
    case "delivery_issue":
    case "wismo":
      return "normal";
    case "question":
      return "low";
    default:
      return "normal";
  }
}

/**
 * "Where is my order?" intent detection (roadmap P3-S11-T04), Arabic and
 * English keyword rules.
 */
export function detectWismoIntent(text: string): boolean {
  const t = text.toLowerCase();
  const arabic = [
    "فين طلب",
    "فين الطلب",
    "وصلني",
    "فين هيتوصل",
    "تتبع",
    "شحنتي",
    "طلبي",
  ];
  const english = [
    "where is my order",
    "where is my parcel",
    "track my order",
    "track my shipment",
    "when will it arrive",
    "not delivered",
    "still not received",
  ];
  return (
    arabic.some((k) => t.includes(k)) || english.some((k) => t.includes(k))
  );
}

export interface TicketRecord {
  id: string;
  tenantId: string;
  customerId: string | null;
  orderId: string | null;
  shipmentId: string | null;
  type: string;
  priority: TicketPriority;
  status: string;
  ownerId: string | null;
  slaDueAt: Date;
  escalated: boolean;
  createdAt: Date;
  resolvedAt: Date | null;
}

/**
 * Tickets, the unified inbox, channels, macros and SLA escalation
 * (roadmap Sprint 11).
 */
export class InboxService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
      /** Sends an outbound message. Returns false when consent is missing. */
      send?: (input: {
        channel: string;
        customerId: string | null;
        body: string;
      }) => Promise<boolean>;
    },
  ) {}

  async createTicket(
    tenantId: string,
    input: {
      customerId?: string | null;
      orderId?: string | null;
      shipmentId?: string | null;
      type?: string;
      body?: string;
      channel?: string;
      /** An unknown customer must be explicit. */
      unknownCustomer?: boolean;
    },
  ): Promise<TicketRecord> {
    if (!input.customerId && !input.unknownCustomer) {
      throw new InboxError(
        "A ticket needs a customer, or the explicit `unknownCustomer` flag.",
      );
    }
    const type = input.type ?? "general";
    const priority = priorityForType(type);
    const id = randomUUID();
    const now = this.deps.clock.now();
    const slaDueAt = new Date(
      now.getTime() + SLA_HOURS[priority] * 3600 * 1000,
    );

    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `insert into tickets
           (id, tenant_id, customer_id, order_id, shipment_id, type, priority, status, sla_due_at)
         values ($1,$2,$3,$4,$5,$6,$7,'open',$8) returning *`,
        [
          id,
          tenantId,
          input.customerId ?? null,
          input.orderId ?? null,
          input.shipmentId ?? null,
          type,
          priority,
          slaDueAt,
        ],
      );
      if (input.body) {
        await client.query(
          `insert into ticket_messages (tenant_id, ticket_id, channel, direction, body, internal)
           values ($1,$2,$3,'inbound',$4,false)`,
          [tenantId, id, input.channel ?? "internal", input.body],
        );
      }
      return this.toTicket(r.rows[0]!);
    });
  }

  async listTickets(
    tenantId: string,
    filter: {
      status?: string;
      priority?: string;
      ownerId?: string;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    } = {},
  ): Promise<TicketRecord[]> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.status) {
        params.push(filter.status);
        conditions.push(`status = $${params.length}`);
      }
      if (filter.priority) {
        params.push(filter.priority);
        conditions.push(`priority = $${params.length}`);
      }
      if (filter.ownerId) {
        params.push(filter.ownerId);
        conditions.push(`owner_id = $${params.length}`);
      }
      if (filter.cursor) {
        params.push(filter.cursor.createdAt, filter.cursor.id);
        conditions.push(
          `(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
        );
      }
      const limitClause =
        filter.limit === undefined
          ? ""
          : ` limit $${(params.push(filter.limit), params.length)}`;
      const r = await client.query<Record<string, unknown>>(
        `select * from tickets where ${conditions.join(" and ")}
          order by created_at desc, id desc${limitClause}`,
        params,
      );
      return r.rows.map((row) => this.toTicket(row));
    });
  }

  async assignTicket(
    tenantId: string,
    ticketId: string,
    ownerId: string,
  ): Promise<TicketRecord> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `update tickets set owner_id=$3, status='assigned'
          where tenant_id=$1 and id=$2 returning *`,
        [tenantId, ticketId, ownerId],
      );
      if (!r.rows[0]) throw new InboxError("Ticket not found.", 404);
      return this.toTicket(r.rows[0]);
    });
  }

  async resolveTicket(
    tenantId: string,
    ticketId: string,
  ): Promise<TicketRecord> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `update tickets set status='resolved', resolved_at=now()
          where tenant_id=$1 and id=$2 returning *`,
        [tenantId, ticketId],
      );
      if (!r.rows[0]) throw new InboxError("Ticket not found.", 404);
      return this.toTicket(r.rows[0]);
    });
  }

  /** Replies to a ticket. Internal notes are never sent to the customer. */
  async reply(
    tenantId: string,
    ticketId: string,
    input: { body: string; internal?: boolean; channel?: string },
  ): Promise<{ id: string; sent: boolean }> {
    const internal = input.internal ?? true;
    let customerId: string | null = null;
    await withTenant(this.deps.pool, tenantId, async (client) => {
      const ticket = await client.query<{ customer_id: string | null }>(
        `select customer_id from tickets where tenant_id=$1 and id=$2`,
        [tenantId, ticketId],
      );
      customerId = ticket.rows[0]?.customer_id ?? null;
      await client.query(
        `insert into ticket_messages (tenant_id, ticket_id, channel, direction, body, internal)
         values ($1,$2,$3,'outbound',$4,$5)`,
        [tenantId, ticketId, input.channel ?? "internal", input.body, internal],
      );
    });

    let sent = false;
    if (!internal && this.deps.send) {
      sent = await this.deps.send({
        channel: input.channel ?? "internal",
        customerId,
        body: input.body,
      });
    }
    return { id: ticketId, sent };
  }

  async listMessages(
    tenantId: string,
    ticketId: string,
  ): Promise<
    {
      id: string;
      body: string;
      internal: boolean;
      direction: string;
      createdAt: Date;
    }[]
  > {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `select * from ticket_messages where tenant_id=$1 and ticket_id=$2
          order by created_at asc`,
        [tenantId, ticketId],
      );
      return r.rows.map((row) => ({
        id: String(row.id),
        body: String(row.body),
        internal: Boolean(row.internal),
        direction: String(row.direction),
        createdAt: new Date(row.created_at as string),
      }));
    });
  }

  /** Escalates tickets that are past their SLA. */
  async sweepOverdue(tenantId: string): Promise<{ escalated: number }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query(
        `update tickets set priority='critical', escalated=true
          where tenant_id=$1 and status not in ('resolved','closed')
            and sla_due_at < now() and not escalated
          returning id`,
        [tenantId],
      );
      return { escalated: r.rowCount ?? 0 };
    });
  }

  // ---- Channels ------------------------------------------------------------

  async createChannel(
    tenantId: string,
    input: {
      type: "whatsapp" | "instagram" | "facebook" | "email";
      name: string;
      maxAttachmentBytes?: number;
    },
  ): Promise<{
    id: string;
    type: string;
    name: string;
    maxAttachmentBytes: number;
  }> {
    const id = randomUUID();
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `insert into channels (id, tenant_id, type, name, max_attachment_bytes)
         values ($1,$2,$3,$4,$5) returning *`,
        [
          id,
          tenantId,
          input.type,
          input.name,
          input.maxAttachmentBytes ?? 10_485_760,
        ],
      );
      return {
        id: String(r.rows[0]!.id),
        type: String(r.rows[0]!.type),
        name: String(r.rows[0]!.name),
        maxAttachmentBytes: Number(r.rows[0]!.max_attachment_bytes),
      };
    });
  }

  /** Ingests an inbound message: finds the customer by phone, appends to the
   * open conversation and opens or updates a ticket. */
  async ingestInbound(
    tenantId: string,
    input: {
      channelId: string;
      phone: string;
      body: string;
      attachmentBytes?: number;
    },
  ): Promise<{
    ticketId: string;
    customerId: string | null;
    intent: "wismo" | "general";
  }> {
    let customerId: string | null = null;
    try {
      const phone = normalizePhone(input.phone);
      customerId = await withTenant(
        this.deps.pool,
        tenantId,
        async (client) => {
          const r = await client.query<{ id: string }>(
            `select id from customers where tenant_id=$1 and phone=$2`,
            [tenantId, phone],
          );
          return r.rows[0]?.id ?? null;
        },
      );
    } catch {
      customerId = null;
    }

    const channel = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<{ max_attachment_bytes: number }>(
          `select max_attachment_bytes from channels where tenant_id=$1 and id=$2`,
          [tenantId, input.channelId],
        );
        return r.rows[0];
      },
    );
    if (!channel) throw new InboxError("Channel not found.", 404);
    if (
      input.attachmentBytes !== undefined &&
      input.attachmentBytes > channel.max_attachment_bytes
    ) {
      throw new InboxError(
        `Attachment exceeds the ${channel.max_attachment_bytes} byte limit.`,
        413,
      );
    }

    const intent = detectWismoIntent(input.body) ? "wismo" : "general";
    const type = intent === "wismo" ? "wismo" : "general";

    return withTenant(this.deps.pool, tenantId, async (client) => {
      const conversation = await client.query<{ id: string }>(
        `select id from conversations
          where tenant_id=$1 and customer_id=$2 and channel_id=$3
          order by last_message_at desc limit 1`,
        [tenantId, customerId ?? "", input.channelId],
      );
      if (conversation.rows[0]) {
        await client.query(
          `update conversations set last_message_at=now() where tenant_id=$1 and id=$2`,
          [tenantId, conversation.rows[0].id],
        );
      } else if (customerId) {
        await client.query(
          `insert into conversations (tenant_id, customer_id, channel_id)
           values ($1,$2,$3)`,
          [tenantId, customerId, input.channelId],
        );
      }

      const open = await client.query<{ id: string }>(
        `select id from tickets
          where tenant_id=$1 and customer_id=$2 and status not in ('resolved','closed')
          order by created_at desc limit 1`,
        [tenantId, customerId ?? ""],
      );
      if (open.rows[0]) {
        await client.query(
          `insert into ticket_messages (tenant_id, ticket_id, channel, direction, body, internal)
           values ($1,$2,'inbox','inbound',$3,false)`,
          [tenantId, open.rows[0].id, input.body],
        );
        return { ticketId: open.rows[0].id, customerId, intent };
      }

      const ticket = await this.createTicket(tenantId, {
        customerId,
        unknownCustomer: customerId === null,
        type,
        body: input.body,
        channel: "inbox",
      });
      return { ticketId: ticket.id, customerId, intent };
    });
  }

  // ---- Macros --------------------------------------------------------------

  async createMacro(
    tenantId: string,
    input: {
      key: string;
      name: string;
      ar: string;
      en: string;
      variables?: string[];
    },
  ): Promise<{ id: string; key: string; variables: string[] }> {
    const id = randomUUID();
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into macros (id, tenant_id, key, name, ar, en, variables)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          tenantId,
          input.key,
          input.name,
          input.ar,
          input.en,
          JSON.stringify(input.variables ?? []),
        ],
      );
    });
    return { id, key: input.key, variables: input.variables ?? [] };
  }

  /** Renders a macro. A macro with an unfilled variable is an error. */
  async renderMacro(
    tenantId: string,
    key: string,
    locale: "ar" | "en",
    vars: Record<string, string>,
  ): Promise<string> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{
        ar: string;
        en: string;
        variables: string[];
      }>(`select ar, en, variables from macros where tenant_id=$1 and key=$2`, [
        tenantId,
        key,
      ]);
      const row = r.rows[0];
      if (!row) throw new InboxError("Macro not found.", 404);
      const template = locale === "ar" ? row.ar : row.en;
      const missing = (row.variables ?? []).filter((v) => !vars[v]);
      if (missing.length > 0) {
        throw new InboxError(
          `Macro "${key}" is missing: ${missing.join(", ")}.`,
        );
      }
      return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
    });
  }

  private toTicket(row: Record<string, unknown>): TicketRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      customerId: (row.customer_id as string | null) ?? null,
      orderId: (row.order_id as string | null) ?? null,
      shipmentId: (row.shipment_id as string | null) ?? null,
      type: String(row.type),
      priority: row.priority as TicketPriority,
      status: String(row.status),
      ownerId: (row.owner_id as string | null) ?? null,
      slaDueAt: new Date(row.sla_due_at as string),
      escalated: Boolean(row.escalated),
      createdAt: new Date(row.created_at as string),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : null,
    };
  }
}
