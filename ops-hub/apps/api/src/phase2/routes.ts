import { paginationOf, toPage } from "../platform/list-contract";
import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { CodService } from "../risk/service";
import { ReceivingService } from "../receiving/service";
import { ReturnsService } from "../returns/service";
import { SettlementService } from "../settlements/service";
import { DlqService } from "../dlq/service";
import { RoutingService } from "../routing/service";
import {
  CycleCountGenerator,
  ExchangeService,
  ReconcilerService,
  RiskGateService,
} from "./extra-services";
import { TenantSettingsService, riskThresholds } from "../settings/service";

export interface Phase2Services {
  receiving: ReceivingService;
  cod: CodService;
  returns: ReturnsService;
  settlements: SettlementService;
  dlq: DlqService;
  routing: RoutingService;
  riskGate: RiskGateService;
  exchanges: ExchangeService;
  reconciler: ReconcilerService;
  cycleCounts: CycleCountGenerator;
  settings: TenantSettingsService;
}

export function registerPhase2Routes(
  app: FastifyInstance,
  options: {
    services: Phase2Services;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { services, requestAuth, audit } = options;
  const {
    receiving,
    cod,
    returns,
    settlements,
    dlq,
    routing,
    riskGate,
    exchanges,
    reconciler,
    cycleCounts,
    settings,
  } = services;

  const actor = (request: Parameters<typeof requirePrincipal>[0]) => {
    const { actor: a, tenantId } = actorAndTenant(requirePrincipal(request));
    return {
      tenantId,
      actor: {
        type: a.kind === "user" ? ("user" as const) : ("api_key" as const),
        id: a.id,
      },
    };
  };

  // ---- Receiving -----------------------------------------------------------
  app.post(
    "/v1/receipts",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request, reply) => {
      const { tenantId, actor: who } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await receiving.createReceipt(
        tenantId,
        {
          locationId: String(body.locationId),
          poId: typeof body.poId === "string" ? body.poId : null,
          lines: (body.lines ?? []) as {
            variantId: string;
            sku: string;
            expectedQty?: number;
            receivedQty: number;
            damagedQty?: number;
            substitutionSku?: string;
          }[],
        },
        who,
      );
      await recordAudit(request, audit, {
        action: "receipt.created",
        objectType: "receipt",
        objectId: result.receipt.id,
        after: result,
      });
      reply.status(201);
      return result;
    },
  );

  app.get(
    "/v1/receipts",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { tenantId } = actor(request);
      return { receipts: await receiving.listReceipts(tenantId) };
    },
  );

  app.post(
    "/v1/receipts/:id/lines/:lineId/release",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request) => {
      const { id, lineId } = request.params as { id: string; lineId: string };
      const { tenantId, actor: who } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const line = await receiving.releaseToBin(
        tenantId,
        {
          receiptId: id,
          lineId,
          scannedSku: String(body.scannedSku ?? ""),
          binCode: String(body.binCode ?? ""),
          quantity: Number(body.quantity ?? 0),
        },
        who,
      );
      await recordAudit(request, audit, {
        action: "receipt.released",
        objectType: "receipt_line",
        objectId: lineId,
        after: line,
      });
      return line;
    },
  );

  app.get(
    "/v1/putaway/suggestion",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { tenantId } = actor(request);
      const query = request.query as {
        variantId?: string;
        locationId?: string;
        zone?: string;
      };
      return receiving.suggestPutaway(tenantId, {
        variantId: String(query.variantId ?? ""),
        locationId: String(query.locationId ?? ""),
        ...(query.zone !== undefined ? { zone: query.zone } : {}),
      });
    },
  );

  app.get(
    "/v1/cycle-counts",
    { preHandler: requirePermission(requestAuth, "inventory:read") },
    async (request) => {
      const { tenantId } = actor(request);
      const query = request.query as { status?: string; locationId?: string };
      return {
        cycleCounts: await receiving.listCycleCounts(tenantId, {
          ...(query.status !== undefined ? { status: query.status } : {}),
          ...(query.locationId !== undefined
            ? { locationId: query.locationId }
            : {}),
        }),
      };
    },
  );

  app.post(
    "/v1/cycle-counts/:id/count",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await receiving.submitCycleCount(tenantId, {
        cycleCountId: id,
        countedQty: Number(body.countedQty ?? -1),
      });
      await recordAudit(request, audit, {
        action: "cycle_count.submitted",
        objectType: "cycle_count",
        objectId: id,
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/cycle-counts/:id/approve",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId, actor: who } = actor(request);
      const result = await receiving.approveCycleCount(
        tenantId,
        id,
        who.id,
        who,
      );
      await recordAudit(request, audit, {
        action: "cycle_count.approved",
        objectType: "cycle_count",
        objectId: id,
        after: result,
      });
      return result;
    },
  );

  // ---- COD confirmation ----------------------------------------------------
  app.post(
    "/v1/cod-tasks",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const { tenantId } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const task = await cod.createTask(tenantId, {
        orderId: String(body.orderId ?? ""),
        ...(body.channel ? { channel: body.channel as "whatsapp" } : {}),
      });
      await recordAudit(request, audit, {
        action: "cod_task.created",
        objectType: "cod_task",
        objectId: task.id,
        after: task,
      });
      reply.status(201);
      return task;
    },
  );

  app.get(
    "/v1/cod-tasks",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { tenantId } = actor(request);
      const query = request.query as { status?: string; orderId?: string };
      const { limit, cursor } = paginationOf(request);
      const rows = await cod.listTasks(tenantId, {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.orderId !== undefined ? { orderId: query.orderId } : {}),
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit);
      return { tasks: page.items, nextCursor: page.nextCursor };
    },
  );

  app.post(
    "/v1/cod-tasks/:id/attempt",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await cod.recordAttempt(tenantId, id, {
        channel: (body.channel as "whatsapp") ?? "whatsapp",
        outcome: body.outcome as "confirmed",
        ...(typeof body.response === "string"
          ? { response: body.response }
          : {}),
      });
      await recordAudit(request, audit, {
        action: "cod_task.attempted",
        objectType: "cod_task",
        objectId: id,
        after: result,
      });
      return result;
    },
  );

  app.get(
    "/v1/orders/:id/risk-score",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actor(request);
      const existing = await cod.getLatestScore(tenantId, id);
      return existing ?? cod.scoreOrder(tenantId, id);
    },
  );

  // ---- Returns & refunds ---------------------------------------------------
  app.post(
    "/v1/returns",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const { tenantId, actor: who } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await returns.createReturn(tenantId, {
        orderId: String(body.orderId ?? ""),
        reasonCode: String(body.reasonCode ?? ""),
        lines: (body.lines ?? []) as {
          orderLineId: string;
          quantity: number;
        }[],
      });
      await recordAudit(request, audit, {
        action: "return.created",
        objectType: "return",
        objectId: result.id,
        after: result,
      });
      void who;
      reply.status(201);
      return result;
    },
  );

  app.get(
    "/v1/returns/:id",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actor(request);
      return returns.getReturn(tenantId, id);
    },
  );

  app.post(
    "/v1/returns/:id/transition",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await returns.transition(
        tenantId,
        id,
        String(body.status ?? "") as Parameters<typeof returns.transition>[2],
      );
      await recordAudit(request, audit, {
        action: "return.transitioned",
        objectType: "return",
        objectId: id,
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/returns/:id/disposition",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId, actor: who } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await returns.applyDisposition(
        tenantId,
        id,
        {
          disposition: String(body.disposition ?? "") as "restock",
          locationId: String(body.locationId ?? ""),
          variantIdByLine: (body.variantIdByLine ?? {}) as Record<
            string,
            string
          >,
        },
        who,
      );
      await recordAudit(request, audit, {
        action: "return.dispositioned",
        objectType: "return",
        objectId: id,
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/refunds",
    { preHandler: requirePermission(requestAuth, "refunds:approve") },
    async (request, reply) => {
      const { tenantId, actor: who } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const refund = await returns.requestRefund(
        tenantId,
        {
          orderId: String(body.orderId ?? ""),
          returnId: typeof body.returnId === "string" ? body.returnId : null,
          amountMinor: Number(body.amountMinor ?? 0),
        },
        who.id,
      );
      await recordAudit(request, audit, {
        action: "refund.requested",
        objectType: "refund",
        objectId: refund.id,
        after: refund,
      });
      reply.status(201);
      return refund;
    },
  );

  app.post(
    "/v1/refunds/:id/approve",
    { preHandler: requirePermission(requestAuth, "refunds:approve") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId, actor: who } = actor(request);
      const result = await returns.approveRefund(tenantId, id, who.id);
      await recordAudit(request, audit, {
        action: "refund.approved",
        objectType: "refund",
        objectId: id,
        after: result,
      });
      return result;
    },
  );

  // ---- Settlement ----------------------------------------------------------
  app.post(
    "/v1/settlements/import",
    { preHandler: requirePermission(requestAuth, "reports:read") },
    async (request, reply) => {
      const { tenantId } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await settlements.importFile(tenantId, {
        content: String(body.content ?? ""),
        carrier: String(body.carrier ?? ""),
      });
      await recordAudit(request, audit, {
        action: "settlement.imported",
        objectType: "settlement_file",
        objectId: result.fileId,
        after: result,
      });
      reply.status(201);
      return result;
    },
  );

  app.get(
    "/v1/reconciliation/daily",
    { preHandler: requirePermission(requestAuth, "reports:read") },
    async (request) => {
      const { tenantId } = actor(request);
      const query = request.query as { date?: string };
      const date = query.date ? new Date(query.date) : new Date();
      return settlements.reconcile(
        tenantId,
        Number.isNaN(date.getTime()) ? new Date() : date,
      );
    },
  );

  // ---- DLQ -----------------------------------------------------------------
  app.get(
    "/v1/dlq",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { tenantId } = actor(request);
      const query = request.query as { status?: string };
      const { limit, cursor } = paginationOf(request);
      const rows = await dlq.list(tenantId, {
        ...(query.status !== undefined
          ? { status: query.status as "dead" }
          : {}),
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit);
      return { entries: page.items, nextCursor: page.nextCursor };
    },
  );

  app.post(
    "/v1/dlq/:id/replay",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actor(request);
      const result = await dlq.replay(tenantId, id);
      await recordAudit(request, audit, {
        action: "dlq.replayed",
        objectType: "dlq_entry",
        objectId: id,
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/dlq/replay-batch",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const { tenantId } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      const result = await dlq.replayBatch(tenantId, ids);
      await recordAudit(request, audit, {
        action: "dlq.replayed_batch",
        objectType: "dlq_entry",
        objectId: ids.join(","),
        after: result,
      });
      return result;
    },
  );

  // ---- Risk gating, exchanges, reconciliation, cycle counts ---------------

  app.post(
    "/v1/orders/:id/risk-gate",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actor(request);
      const thresholds = await riskThresholds(settings, tenantId);
      const decision = await riskGate.gate(tenantId, id, { thresholds });
      await recordAudit(request, audit, {
        action: "order.risk_gated",
        objectType: "order",
        objectId: id,
        after: decision,
      });
      return decision;
    },
  );

  app.post(
    "/v1/exchanges",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const { tenantId } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await exchanges.exchange(tenantId, {
        orderId: String(body.orderId ?? ""),
        originalLineId: String(body.originalLineId ?? ""),
        replacementVariantId: String(body.replacementVariantId ?? ""),
        replacementQuantity: Number(body.replacementQuantity ?? 0),
      });
      await recordAudit(request, audit, {
        action: "exchange.created",
        objectType: "order",
        objectId: String(body.orderId ?? ""),
        after: result,
      });
      reply.status(201);
      return result;
    },
  );

  app.post(
    "/v1/reconciliation/orders",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { tenantId } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const source = (body.source ?? []) as {
        externalOrderId: string;
        orderNumber: string;
        status: string;
      }[];
      const result = await reconciler.reconcileOrders(tenantId, source);
      await recordAudit(request, audit, {
        action: "reconciliation.ran",
        objectType: "tenant",
        objectId: tenantId,
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/reconciliation/orders/restore",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { tenantId } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await reconciler.restoreDeletedOrder(tenantId, {
        externalOrderId: String(body.externalOrderId ?? ""),
        orderNumber: String(body.orderNumber ?? ""),
        status: String(body.status ?? "pending"),
      });
      await recordAudit(request, audit, {
        action: "reconciliation.restored",
        objectType: "order",
        objectId: result.orderId ?? String(body.externalOrderId ?? ""),
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/cycle-counts/generate",
    { preHandler: requirePermission(requestAuth, "inventory:write") },
    async (request) => {
      const { tenantId } = actor(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await cycleCounts.generate(
        tenantId,
        String(body.locationId ?? ""),
      );
      await recordAudit(request, audit, {
        action: "cycle_count.generated",
        objectType: "location",
        objectId: String(body.locationId ?? ""),
        after: result,
      });
      return result;
    },
  );

  // ---- Routing -------------------------------------------------------------
  app.get(
    "/v1/routing/preview",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { tenantId } = actor(request);
      const query = request.query as { order_id?: string; orderId?: string };
      const orderId = query.order_id ?? query.orderId ?? "";
      return routing.preview(tenantId, orderId);
    },
  );
}
