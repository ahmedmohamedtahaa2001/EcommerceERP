import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import { paginationOf, toPage } from "../platform/list-contract";
import type { AuditWriter } from "../audit/types";
import { SourcingService } from "../suppliers/service";
import { ScorecardService } from "../scorecards/service";
import { InboxService } from "../inbox/service";
import { CrmService } from "../crm/service";
import { StarterAutomationService } from "../automations/starter";

export interface Phase3Services {
  sourcing: SourcingService;
  scorecards: ScorecardService;
  inbox: InboxService;
  crm: CrmService;
  starterAutomations: StarterAutomationService;
}

export function registerPhase3Routes(
  app: FastifyInstance,
  options: {
    services: Phase3Services;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { services, requestAuth, audit } = options;
  const { sourcing, scorecards, inbox, crm, starterAutomations } = services;

  const tenantOf = (request: Parameters<typeof requirePrincipal>[0]) =>
    actorAndTenant(requirePrincipal(request)).tenantId;

  // ---- Suppliers and purchase orders ---------------------------------------

  app.post(
    "/v1/suppliers",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request, reply) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const supplier = await sourcing.createSupplier(tenantId, {
        name: String(body.name ?? ""),
        contactName: (body.contactName as string) ?? null,
        contactEmail: (body.contactEmail as string) ?? null,
        contactPhone: (body.contactPhone as string) ?? null,
        leadTimeDays: Number(body.leadTimeDays ?? 0),
        moq: Number(body.moq ?? 1),
        paymentTermsDays: Number(body.paymentTermsDays ?? 0),
      });
      await recordAudit(request, audit, {
        action: "supplier.created",
        objectType: "supplier",
        objectId: supplier.id,
        after: supplier,
      });
      reply.status(201);
      return supplier;
    },
  );

  app.get(
    "/v1/suppliers",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const tenantId = tenantOf(request);
      const { limit, cursor } = paginationOf(request);
      const rows = await sourcing.listSuppliers(tenantId, {
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit);
      return { suppliers: page.items, nextCursor: page.nextCursor };
    },
  );

  app.get(
    "/v1/reorder/suggestions",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const tenantId = tenantOf(request);
      const query = request.query as { safetyStockDays?: string };
      return {
        suggestions: await sourcing.reorderSuggestions(tenantId, {
          ...(query.safetyStockDays !== undefined
            ? { safetyStockDays: Number(query.safetyStockDays) }
            : {}),
        }),
      };
    },
  );

  app.post(
    "/v1/purchase-orders",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request, reply) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const po = await sourcing.createPurchaseOrder(tenantId, {
        supplierId: String(body.supplierId ?? ""),
        lines: (body.lines ?? []) as {
          variantId: string;
          quantity: number;
          unitCostMinor: number;
        }[],
      });
      await recordAudit(request, audit, {
        action: "purchase_order.created",
        objectType: "purchase_order",
        objectId: po.id,
        after: po,
      });
      reply.status(201);
      return po;
    },
  );

  app.get(
    "/v1/purchase-orders",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const tenantId = tenantOf(request);
      const query = request.query as { status?: string };
      const { limit, cursor } = paginationOf(request);
      const rows = await sourcing.listPurchaseOrders(tenantId, {
        ...(query.status !== undefined ? { status: query.status } : {}),
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit);
      return {
        purchaseOrders: page.items,
        nextCursor: page.nextCursor,
      };
    },
  );

  app.get(
    "/v1/purchase-orders/:id",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const tenantId = tenantOf(request);
      return sourcing.getPurchaseOrder(tenantId, id);
    },
  );

  app.post(
    "/v1/purchase-orders/:id/transition",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { actor, tenantId } = actorAndTenant(requirePrincipal(request));
      const body = (request.body ?? {}) as Record<string, unknown>;
      const po = await sourcing.transition(
        tenantId,
        id,
        String(body.status ?? "") as Parameters<typeof sourcing.transition>[2],
        { id: actor.id },
      );
      await recordAudit(request, audit, {
        action: "purchase_order.transitioned",
        objectType: "purchase_order",
        objectId: id,
        after: po,
      });
      return po;
    },
  );

  app.post(
    "/v1/purchase-orders/:id/lines/:lineId/receive",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request) => {
      const { id, lineId } = request.params as { id: string; lineId: string };
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const po = await sourcing.receiveLine(tenantId, {
        poId: id,
        poLineId: lineId,
        quantity: Number(body.quantity ?? 0),
      });
      await recordAudit(request, audit, {
        action: "purchase_order.received",
        objectType: "purchase_order",
        objectId: id,
        after: po,
      });
      return po;
    },
  );

  // ---- Scorecards ----------------------------------------------------------

  app.get(
    "/v1/suppliers/:id/scorecard",
    { preHandler: requirePermission(requestAuth, "reports:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const tenantId = tenantOf(request);
      const query = request.query as { start?: string; end?: string };
      const end = query.end ? new Date(query.end) : new Date();
      const start = query.start
        ? new Date(query.start)
        : new Date(end.getTime() - 30 * 24 * 3600 * 1000);
      return scorecards.supplierScorecard(tenantId, id, { start, end });
    },
  );

  app.post(
    "/v1/purchase-orders/:id/landed-cost",
    { preHandler: requirePermission(requestAuth, "reports:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const allocations = await scorecards.allocateLandedCost(tenantId, {
        poId: id,
        freightMinor: Number(body.freightMinor ?? 0),
        dutiesMinor: Number(body.dutiesMinor ?? 0),
        surchargesMinor: Number(body.surchargesMinor ?? 0),
        ...(body.basis ? { basis: body.basis as "value" } : {}),
      });
      await recordAudit(request, audit, {
        action: "landed_cost.allocated",
        objectType: "purchase_order",
        objectId: id,
        after: allocations,
      });
      return { allocations };
    },
  );

  app.get(
    "/v1/carriers/:carrier/scorecard",
    { preHandler: requirePermission(requestAuth, "reports:read") },
    async (request) => {
      const { carrier } = request.params as { carrier: string };
      const tenantId = tenantOf(request);
      const query = request.query as {
        governorate?: string;
        service?: string;
        start?: string;
        end?: string;
      };
      const end = query.end ? new Date(query.end) : new Date();
      const start = query.start
        ? new Date(query.start)
        : new Date(end.getTime() - 30 * 24 * 3600 * 1000);
      return scorecards.carrierScorecard(tenantId, {
        carrier,
        governorateCode: query.governorate ?? "C",
        ...(query.service !== undefined ? { service: query.service } : {}),
        period: { start, end },
      });
    },
  );

  app.post(
    "/v1/claims",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const claim = await scorecards.createClaim(tenantId, {
        carrier: String(body.carrier ?? ""),
        shipmentId: (body.shipmentId as string) ?? null,
        type: (body.type as "lost") ?? "lost",
        description: String(body.description ?? ""),
        evidence: (body.evidence as string[]) ?? [],
      });
      await recordAudit(request, audit, {
        action: "claim.created",
        objectType: "claim",
        objectId: claim.id,
        after: claim,
      });
      reply.status(201);
      return claim;
    },
  );

  app.post(
    "/v1/claims/:id/close",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await scorecards.closeClaim(tenantId, id, {
        waived: body.waived === true,
        evidence: (body.evidence as string[]) ?? [],
      });
      await recordAudit(request, audit, {
        action: "claim.closed",
        objectType: "claim",
        objectId: id,
        after: result,
      });
      return result;
    },
  );

  // ---- Tickets and inbox ---------------------------------------------------

  app.post(
    "/v1/tickets",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const ticket = await inbox.createTicket(tenantId, {
        customerId: (body.customerId as string) ?? null,
        orderId: (body.orderId as string) ?? null,
        shipmentId: (body.shipmentId as string) ?? null,
        type: (body.type as string) ?? "general",
        body: (body.body as string) ?? undefined,
        unknownCustomer: body.unknownCustomer === true,
      });
      await recordAudit(request, audit, {
        action: "ticket.created",
        objectType: "ticket",
        objectId: ticket.id,
        after: ticket,
      });
      reply.status(201);
      return ticket;
    },
  );

  app.get(
    "/v1/tickets",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const tenantId = tenantOf(request);
      const query = request.query as {
        status?: string;
        priority?: string;
        ownerId?: string;
      };
      const { limit, cursor } = paginationOf(request);
      const rows = await inbox.listTickets(tenantId, {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.priority !== undefined ? { priority: query.priority } : {}),
        ...(query.ownerId !== undefined ? { ownerId: query.ownerId } : {}),
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit);
      return { tickets: page.items, nextCursor: page.nextCursor };
    },
  );

  app.post(
    "/v1/tickets/:id/assign",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const ticket = await inbox.assignTicket(
        tenantId,
        id,
        String(body.ownerId ?? ""),
      );
      await recordAudit(request, audit, {
        action: "ticket.assigned",
        objectType: "ticket",
        objectId: id,
        after: ticket,
      });
      return ticket;
    },
  );

  app.post(
    "/v1/tickets/:id/reply",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await inbox.reply(tenantId, id, {
        body: String(body.body ?? ""),
        internal: body.internal !== false,
        channel: (body.channel as string) ?? "internal",
      });
      await recordAudit(request, audit, {
        action: "ticket.replied",
        objectType: "ticket",
        objectId: id,
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/tickets/sweep-overdue",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const tenantId = tenantOf(request);
      const result = await inbox.sweepOverdue(tenantId);
      await recordAudit(request, audit, {
        action: "ticket.swept_overdue",
        objectType: "ticket",
        objectId: "sweep",
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/inbox/messages",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await inbox.ingestInbound(tenantId, {
        channelId: String(body.channelId ?? ""),
        phone: String(body.phone ?? ""),
        body: String(body.body ?? ""),
        ...(body.attachmentBytes !== undefined
          ? { attachmentBytes: Number(body.attachmentBytes) }
          : {}),
      });
      await recordAudit(request, audit, {
        action: "inbox.message_received",
        objectType: "ticket",
        objectId: result.ticketId,
        after: result,
      });
      reply.status(201);
      return result;
    },
  );

  app.post(
    "/v1/macros",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const macro = await inbox.createMacro(tenantId, {
        key: String(body.key ?? ""),
        name: String(body.name ?? ""),
        ar: String(body.ar ?? ""),
        en: String(body.en ?? ""),
        variables: (body.variables as string[]) ?? [],
      });
      await recordAudit(request, audit, {
        action: "macro.created",
        objectType: "macro",
        objectId: macro.id,
        after: macro,
      });
      reply.status(201);
      return macro;
    },
  );

  app.get(
    "/v1/macros/:key/render",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { key } = request.params as { key: string };
      const tenantId = tenantOf(request);
      const query = request.query as { locale?: string; orderNumber?: string };
      return {
        text: await inbox.renderMacro(
          tenantId,
          key,
          query.locale === "en" ? "en" : "ar",
          {
            ...(query.orderNumber !== undefined
              ? { orderNumber: query.orderNumber }
              : {}),
          },
        ),
      };
    },
  );

  // ---- CRM, segments, automations, KPIs ------------------------------------

  app.get(
    "/v1/customers/:id/profile",
    { preHandler: requirePermission(requestAuth, "customers:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const tenantId = tenantOf(request);
      return crm.profile(tenantId, id);
    },
  );

  app.post(
    "/v1/consents",
    { preHandler: requirePermission(requestAuth, "customers:write") },
    async (request, reply) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const consent = await crm.recordConsent(tenantId, {
        customerId: String(body.customerId ?? ""),
        channel: String(body.channel ?? "email"),
        purpose: (body.purpose as "marketing") ?? "marketing",
        granted: body.granted !== false,
        source: String(body.source ?? "api"),
      });
      await recordAudit(request, audit, {
        action: "consent.recorded",
        objectType: "consent",
        objectId: consent.id,
        after: consent,
      });
      reply.status(201);
      return consent;
    },
  );

  app.post(
    "/v1/segments",
    { preHandler: requirePermission(requestAuth, "customers:write") },
    async (request, reply) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const segment = await crm.createSegment(tenantId, {
        key: String(body.key ?? ""),
        name: String(body.name ?? ""),
        definition: (body.definition as Record<string, unknown>) ?? {},
      });
      await recordAudit(request, audit, {
        action: "segment.created",
        objectType: "segment",
        objectId: segment.id,
        after: segment,
      });
      reply.status(201);
      return segment;
    },
  );

  app.post(
    "/v1/segments/:key/refresh",
    { preHandler: requirePermission(requestAuth, "customers:write") },
    async (request) => {
      const { key } = request.params as { key: string };
      const tenantId = tenantOf(request);
      const result = await crm.refreshSegment(tenantId, key);
      await recordAudit(request, audit, {
        action: "segment.refreshed",
        objectType: "segment",
        objectId: key,
        after: result,
      });
      return result;
    },
  );

  app.get(
    "/v1/segments/:key/members",
    { preHandler: requirePermission(requestAuth, "customers:read") },
    async (request) => {
      const { key } = request.params as { key: string };
      const tenantId = tenantOf(request);
      return { members: await crm.listSegmentMembers(tenantId, key) };
    },
  );

  app.post(
    "/v1/automations",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request, reply) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const automation = await crm.createAutomation(tenantId, {
        key: String(body.key ?? ""),
        name: String(body.name ?? ""),
        triggerEvent: String(body.triggerEvent ?? ""),
        conditions: (body.conditions as Record<string, unknown>) ?? {},
        actions: (body.actions as Record<string, unknown>[]) ?? [],
      });
      await recordAudit(request, audit, {
        action: "automation.created",
        objectType: "automation",
        objectId: automation.id,
        after: automation,
      });
      reply.status(201);
      return automation;
    },
  );

  app.post(
    "/v1/automations/run",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await crm.runAutomations(tenantId, {
        type: String(body.type ?? ""),
        payload: (body.payload as Record<string, unknown>) ?? {},
      });
      await recordAudit(request, audit, {
        action: "automation.ran",
        objectType: "automation",
        objectId: "run",
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/starter-automations/install",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const tenantId = tenantOf(request);
      const result = await starterAutomations.install(tenantId);
      await recordAudit(request, audit, {
        action: "starter_automations.installed",
        objectType: "automation",
        objectId: "starter",
        after: result,
      });
      return result;
    },
  );

  app.get(
    "/v1/starter-automations",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const tenantId = tenantOf(request);
      return { automations: await starterAutomations.list(tenantId) };
    },
  );

  app.post(
    "/v1/starter-automations/:key/enabled",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { key } = request.params as { key: string };
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await starterAutomations.setEnabled(
        tenantId,
        key,
        body.enabled !== false,
      );
      await recordAudit(request, audit, {
        action: "starter_automation.toggled",
        objectType: "automation",
        objectId: key,
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/starter-automations/:key/run",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { key } = request.params as { key: string };
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await starterAutomations.runFixture(
        tenantId,
        key,
        (body.payload as Record<string, unknown>) ?? {},
      );
      await recordAudit(request, audit, {
        action: "starter_automation.ran",
        objectType: "automation",
        objectId: key,
        after: result,
      });
      return result;
    },
  );

  app.get(
    "/v1/kpis",
    { preHandler: requirePermission(requestAuth, "reports:read") },
    async (request) => {
      const tenantId = tenantOf(request);
      const query = request.query as { date?: string; metric?: string };
      const date = query.date ? new Date(query.date) : new Date();
      const kpis = await crm.kpis(
        tenantId,
        Number.isNaN(date.getTime()) ? new Date() : date,
      );
      return {
        kpis: query.metric
          ? kpis.filter((k) => k.metric === query.metric)
          : kpis,
      };
    },
  );

  app.post(
    "/v1/alerts/evaluate",
    { preHandler: requirePermission(requestAuth, "reports:read") },
    async (request) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await crm.evaluateAlerts(tenantId, {
        ...(body.oversold !== undefined
          ? { oversold: Number(body.oversold) }
          : {}),
        ...(body.openExceptions !== undefined
          ? { openExceptions: Number(body.openExceptions) }
          : {}),
        ...(body.unmatchedCodMinor !== undefined
          ? { unmatchedCodMinor: Number(body.unmatchedCodMinor) }
          : {}),
        ...(body.codCollectionRate !== undefined
          ? { codCollectionRate: Number(body.codCollectionRate) }
          : {}),
      });
      await recordAudit(request, audit, {
        action: "alerts.evaluated",
        objectType: "alert",
        objectId: "evaluate",
        after: result,
      });
      return result;
    },
  );
}
