import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export type PoStatus =
  | "draft"
  | "pending_approval"
  | "sent"
  | "acknowledged"
  | "confirmed"
  | "partially_shipped"
  | "shipped"
  | "in_transit"
  | "arrived"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled"
  | "exception";

export class SourcingError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "SourcingError";
    this.statusCode = statusCode;
  }
}

const PO_TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["sent", "cancelled"],
  sent: ["acknowledged", "cancelled", "exception"],
  acknowledged: ["confirmed", "exception"],
  confirmed: ["partially_shipped", "shipped", "exception"],
  partially_shipped: ["shipped", "exception"],
  shipped: ["in_transit", "exception"],
  in_transit: ["arrived", "exception"],
  arrived: ["partially_received", "received", "exception"],
  partially_received: ["received", "exception"],
  received: ["closed"],
  closed: [],
  cancelled: [],
  exception: ["cancelled"],
};

export interface SupplierRecord {
  id: string;
  tenantId: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  leadTimeDays: number;
  actualLeadTimeDays: number;
  moq: number;
  paymentTermsDays: number;
  documentsChecklist: Record<string, boolean>;
  isBackup: boolean;
}

export interface PurchaseOrderRecord {
  id: string;
  tenantId: string;
  supplierId: string;
  number: string;
  status: PoStatus;
  currency: string;
  totalMinor: number;
  expectedAt: Date | null;
  createdBy: string | null;
  approvedBy: string | null;
  sentAt: Date | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
}

export interface PoLineRecord {
  id: string;
  tenantId: string;
  poId: string;
  variantId: string;
  quantity: number;
  unitCostMinor: number;
  receivedQty: number;
}

/**
 * Suppliers, purchase orders and the reorder engine (roadmap Sprint 9).
 *
 * The reorder point uses a recency-weighted demand average so a recent
 * spike moves the estimate more than a flat average would.
 */
export class SourcingService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
      /** POs above this amount need approval. */
      approvalThresholdMinor?: number;
      /** Half-life in days for the recency-weighted demand average. */
      demandHalfLifeDays?: number;
    },
  ) {}

  // ---- Suppliers -----------------------------------------------------------

  async createSupplier(
    tenantId: string,
    input: {
      name: string;
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      leadTimeDays?: number;
      moq?: number;
      paymentTermsDays?: number;
      documentsChecklist?: Record<string, boolean>;
    },
  ): Promise<SupplierRecord> {
    const id = randomUUID();
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `insert into suppliers
           (id, tenant_id, name, contact_name, contact_email, contact_phone,
            lead_time_days, moq, payment_terms_days, documents_checklist)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
        [
          id,
          tenantId,
          input.name,
          input.contactName ?? null,
          input.contactEmail ?? null,
          input.contactPhone ?? null,
          input.leadTimeDays ?? 0,
          input.moq ?? 1,
          input.paymentTermsDays ?? 0,
          JSON.stringify(input.documentsChecklist ?? {}),
        ],
      );
      return this.toSupplier(r.rows[0]!);
    });
  }

  async listSuppliers(tenantId: string): Promise<SupplierRecord[]> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `select * from suppliers where tenant_id=$1 order by name asc`,
        [tenantId],
      );
      return r.rows.map((row) => this.toSupplier(row));
    });
  }

  async mapSupplierSku(
    tenantId: string,
    input: {
      supplierId: string;
      variantId: string;
      supplierSku: string;
      packSize?: number;
      isBackup?: boolean;
    },
  ): Promise<{
    id: string;
    supplierId: string;
    variantId: string;
    supplierSku: string;
    packSize: number;
  }> {
    const id = randomUUID();
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `insert into supplier_skus
           (id, tenant_id, supplier_id, variant_id, supplier_sku, pack_size, is_backup)
         values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [
          id,
          tenantId,
          input.supplierId,
          input.variantId,
          input.supplierSku,
          input.packSize ?? 1,
          input.isBackup ?? false,
        ],
      );
      const row = r.rows[0]!;
      return {
        id: String(row.id),
        supplierId: String(row.supplier_id),
        variantId: String(row.variant_id),
        supplierSku: String(row.supplier_sku),
        packSize: Number(row.pack_size),
      };
    });
  }

  // ---- Reorder engine ------------------------------------------------------

  /**
   * Reorder point = recency-weighted average daily demand × lead time +
   * safety stock.
   */
  reorderPoint(input: {
    sales: { date: Date; quantity: number }[];
    leadTimeDays: number;
    safetyStock: number;
    halfLifeDays?: number;
  }): { averageDailyDemand: number; reorderPoint: number } {
    const halfLife = input.halfLifeDays ?? this.deps.demandHalfLifeDays ?? 7;
    const now = this.deps.clock.now().getTime();
    let weighted = 0;
    let weightSum = 0;
    for (const sale of input.sales) {
      const ageDays = Math.max(
        0,
        (now - new Date(sale.date).getTime()) / (24 * 3600 * 1000),
      );
      const weight = Math.pow(0.5, ageDays / halfLife);
      weighted += sale.quantity * weight;
      weightSum += weight;
    }
    const averageDailyDemand = weightSum === 0 ? 0 : weighted / weightSum;
    return {
      averageDailyDemand,
      reorderPoint: Math.ceil(
        averageDailyDemand * input.leadTimeDays + input.safetyStock,
      ),
    };
  }

  /** Draft purchase orders grouped by supplier, respecting MOQ and pack
   * size. Nothing below the MOQ is suggested. */
  async reorderSuggestions(
    tenantId: string,
    input: { locationId?: string; safetyStockDays?: number },
  ): Promise<
    {
      supplierId: string;
      supplierName: string;
      lines: {
        variantId: string;
        sku: string;
        quantity: number;
        unitCostMinor: number;
        reason: string;
      }[];
      totalMinor: number;
    }[]
  > {
    const halfLife = this.deps.demandHalfLifeDays ?? 7;
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const suppliers = await client.query<{
        id: string;
        name: string;
        lead_time_days: number;
        moq: number;
      }>(
        `select id, name, lead_time_days, moq from suppliers
          where tenant_id=$1 and not is_backup`,
        [tenantId],
      );

      const stock = await client.query<{
        variant_id: string;
        sku: string;
        on_hand: string;
        reserved: string;
        supplier_id: string | null;
        supplier_sku: string | null;
        pack_size: number | null;
        unit_cost_minor: string | null;
      }>(
        `select v.id as variant_id, v.sku,
                coalesce((select sum(sb.quantity) from stock_balances sb
                           where sb.tenant_id=v.tenant_id and sb.variant_id=v.id
                             and sb.bucket='on_hand'),0)::text as on_hand,
                coalesce((select sum(sb.quantity) from stock_balances sb
                           where sb.tenant_id=v.tenant_id and sb.variant_id=v.id
                             and sb.bucket='reserved'),0)::text as reserved,
                ss.supplier_id, ss.supplier_sku, ss.pack_size,
                (select avg(pl.unit_cost_minor) from po_lines pl
                   join purchase_orders po on po.id=pl.po_id and po.tenant_id=pl.tenant_id
                  where pl.tenant_id=v.tenant_id and pl.variant_id=v.id)::text as unit_cost_minor
           from variants v
           left join supplier_skus ss on ss.variant_id=v.id and ss.tenant_id=v.tenant_id
             and not ss.is_backup
          where v.tenant_id=$1`,
        [tenantId],
      );

      const sales = await client.query<{
        variant_id: string;
        date: Date;
        quantity: string;
      }>(
        `select ol.variant_id, o.created_at as date, sum(ol.quantity)::text as quantity
           from order_lines ol join orders o on o.id=ol.order_id and o.tenant_id=ol.tenant_id
          where ol.tenant_id=$1 and o.created_at > now() - interval '60 days'
          group by ol.variant_id, o.created_at`,
        [tenantId],
      );

      const salesByVariant = new Map<
        string,
        { date: Date; quantity: number }[]
      >();
      for (const row of sales.rows) {
        const list = salesByVariant.get(row.variant_id) ?? [];
        list.push({ date: row.date, quantity: Number(row.quantity) });
        salesByVariant.set(row.variant_id, list);
      }

      const safetyStockDays = input.safetyStockDays ?? 14;
      const grouped = new Map<
        string,
        {
          supplierId: string;
          supplierName: string;
          lines: {
            variantId: string;
            sku: string;
            quantity: number;
            unitCostMinor: number;
            reason: string;
          }[];
          totalMinor: number;
        }
      >();

      for (const row of stock.rows) {
        if (!row.supplier_id) continue;
        const supplier = suppliers.rows.find((s) => s.id === row.supplier_id);
        if (!supplier) continue;
        const { reorderPoint } = this.reorderPoint({
          sales: salesByVariant.get(row.variant_id) ?? [],
          leadTimeDays: supplier.lead_time_days,
          safetyStock: Math.round(
            (Number(row.on_hand) || 0) * 0 + safetyStockDays * 0.5,
          ),
          halfLifeDays: halfLife,
        });
        const available = Number(row.on_hand) - Number(row.reserved);
        if (available >= reorderPoint) continue;

        const needed = Math.max(reorderPoint - available, 0);
        const packSize = row.pack_size ?? 1;
        const moq = supplier.moq;
        let quantity = Math.ceil(needed / packSize) * packSize;
        if (quantity < moq) quantity = 0; // below MOQ — never suggested
        if (quantity === 0) continue;

        const unitCostMinor = Math.round(Number(row.unit_cost_minor ?? 0));
        const entry = grouped.get(supplier.id) ?? {
          supplierId: supplier.id,
          supplierName: supplier.name,
          lines: [],
          totalMinor: 0,
        };
        entry.lines.push({
          variantId: row.variant_id,
          sku: row.sku,
          quantity,
          unitCostMinor,
          reason: `on hand ${available} below reorder point ${reorderPoint}`,
        });
        entry.totalMinor += quantity * unitCostMinor;
        grouped.set(supplier.id, entry);
      }

      return [...grouped.values()];
    });
  }

  // ---- Purchase orders -----------------------------------------------------

  async createPurchaseOrder(
    tenantId: string,
    input: {
      supplierId: string;
      lines: { variantId: string; quantity: number; unitCostMinor: number }[];
      expectedAt?: Date | null;
      createdBy?: string | null;
    },
  ): Promise<PurchaseOrderRecord> {
    if (input.lines.length === 0) {
      throw new SourcingError("A purchase order needs at least one line.");
    }
    const totalMinor = input.lines.reduce(
      (sum, l) => sum + l.quantity * l.unitCostMinor,
      0,
    );
    const threshold = this.deps.approvalThresholdMinor ?? 0;
    const status: PoStatus =
      totalMinor > threshold ? "pending_approval" : "draft";
    const id = randomUUID();
    const number = `PO-${Date.now().toString().slice(-6)}`;

    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `insert into purchase_orders
           (id, tenant_id, supplier_id, number, status, currency, total_minor, expected_at, created_by)
         values ($1,$2,$3,$4,$5,'EGP',$6,$7,$8) returning *`,
        [
          id,
          tenantId,
          input.supplierId,
          number,
          status,
          totalMinor,
          input.expectedAt ?? null,
          input.createdBy ?? null,
        ],
      );
      for (const line of input.lines) {
        await client.query(
          `insert into po_lines (tenant_id, po_id, variant_id, quantity, unit_cost_minor)
           values ($1,$2,$3,$4,$5)`,
          [tenantId, id, line.variantId, line.quantity, line.unitCostMinor],
        );
      }
      await client.query(
        `insert into po_events (tenant_id, po_id, event, payload)
         values ($1,$2,'created',$3)`,
        [tenantId, id, JSON.stringify({ totalMinor, status })],
      );
      return this.toPurchaseOrder(r.rows[0]!);
    });
  }

  async getPurchaseOrder(
    tenantId: string,
    poId: string,
  ): Promise<{ order: PurchaseOrderRecord; lines: PoLineRecord[] }> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `select * from purchase_orders where tenant_id=$1 and id=$2`,
        [tenantId, poId],
      );
      if (!r.rows[0]) throw new SourcingError("Purchase order not found.", 404);
      const lines = await client.query<Record<string, unknown>>(
        `select * from po_lines where tenant_id=$1 and po_id=$2 order by created_at asc`,
        [tenantId, poId],
      );
      return {
        order: this.toPurchaseOrder(r.rows[0]),
        lines: lines.rows.map((row) => this.toPoLine(row)),
      };
    });
  }

  async listPurchaseOrders(
    tenantId: string,
    filter: { status?: string } = {},
  ): Promise<PurchaseOrderRecord[]> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.status) {
        params.push(filter.status);
        conditions.push(`status = $${params.length}`);
      }
      const r = await client.query<Record<string, unknown>>(
        `select * from purchase_orders where ${conditions.join(" and ")}
          order by created_at desc`,
        params,
      );
      return r.rows.map((row) => this.toPurchaseOrder(row));
    });
  }

  /** Moves a PO along its lifecycle; every change is recorded in
   * `po_events`. */
  async transition(
    tenantId: string,
    poId: string,
    status: PoStatus,
    actor: { id: string } | null,
  ): Promise<PurchaseOrderRecord> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const current = await client.query<{ status: string }>(
        `select status from purchase_orders where tenant_id=$1 and id=$2`,
        [tenantId, poId],
      );
      const row = current.rows[0];
      if (!row) throw new SourcingError("Purchase order not found.", 404);
      const from = row.status as PoStatus;
      if (!PO_TRANSITIONS[from].includes(status)) {
        throw new SourcingError(
          `Cannot move a purchase order from ${from} to ${status}.`,
        );
      }
      const updated = await client.query<Record<string, unknown>>(
        `update purchase_orders set status=$3, updated_at=now(),
                approved_by = case when $3='sent' then $4 else approved_by end,
                sent_at = case when $3='sent' then now() else sent_at end,
                acknowledged_at = case when $3='acknowledged' then now() else acknowledged_at end,
                closed_at = case when $3='closed' then now() else closed_at end
          where tenant_id=$1 and id=$2 returning *`,
        [tenantId, poId, status, actor?.id ?? null],
      );
      await client.query(
        `insert into po_events (tenant_id, po_id, event, payload)
         values ($1,$2,$3,$4)`,
        [tenantId, poId, status, JSON.stringify({ from, to: status })],
      );
      return this.toPurchaseOrder(updated.rows[0]!);
    });
  }

  /** Records a receipt against a PO line and moves the PO's status. */
  async receiveLine(
    tenantId: string,
    input: { poId: string; poLineId: string; quantity: number },
  ): Promise<PurchaseOrderRecord> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const line = await client.query<{
        quantity: number;
        received_qty: number;
      }>(
        `select quantity, received_qty from po_lines where tenant_id=$1 and id=$2`,
        [tenantId, input.poLineId],
      );
      const row = line.rows[0];
      if (!row) throw new SourcingError("PO line not found.", 404);
      const total = row.quantity;
      const received = row.received_qty + input.quantity;
      if (received > total) {
        throw new SourcingError(
          `Receiving ${received} unit(s) would exceed the ${total} ordered on this line.`,
        );
      }
      await client.query(
        `update po_lines set received_qty=$3 where tenant_id=$1 and id=$2`,
        [tenantId, input.poLineId, received],
      );
      await client.query(
        `insert into po_events (tenant_id, po_id, event, payload)
         values ($1,$2,'received',$3)`,
        [
          tenantId,
          input.poId,
          JSON.stringify({
            poLineId: input.poLineId,
            quantity: input.quantity,
          }),
        ],
      );
      const all = await client.query<{ total: string; received: string }>(
        `select coalesce(sum(quantity),0)::text as total,
                coalesce(sum(received_qty),0)::text as received
           from po_lines where tenant_id=$1 and po_id=$2`,
        [tenantId, input.poId],
      );
      const summary = all.rows[0]!;
      const next: PoStatus =
        Number(summary.received) >= Number(summary.total)
          ? "received"
          : Number(summary.received) > 0
            ? "partially_received"
            : "confirmed";
      const updated = await client.query<Record<string, unknown>>(
        `update purchase_orders set status=$3, updated_at=now()
          where tenant_id=$1 and id=$2 returning *`,
        [tenantId, input.poId, next],
      );
      return this.toPurchaseOrder(updated.rows[0]!);
    });
  }

  private toSupplier(row: Record<string, unknown>): SupplierRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      name: String(row.name),
      contactName: (row.contact_name as string | null) ?? null,
      contactEmail: (row.contact_email as string | null) ?? null,
      contactPhone: (row.contact_phone as string | null) ?? null,
      leadTimeDays: Number(row.lead_time_days),
      actualLeadTimeDays: Number(row.actual_lead_time_days),
      moq: Number(row.moq),
      paymentTermsDays: Number(row.payment_terms_days),
      documentsChecklist: (row.documents_checklist ?? {}) as Record<
        string,
        boolean
      >,
      isBackup: Boolean(row.is_backup),
    };
  }

  private toPurchaseOrder(row: Record<string, unknown>): PurchaseOrderRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      supplierId: String(row.supplier_id),
      number: String(row.number),
      status: row.status as PoStatus,
      currency: String(row.currency),
      totalMinor: Number(row.total_minor),
      expectedAt: row.expected_at ? new Date(row.expected_at as string) : null,
      createdBy: (row.created_by as string | null) ?? null,
      approvedBy: (row.approved_by as string | null) ?? null,
      sentAt: row.sent_at ? new Date(row.sent_at as string) : null,
      acknowledgedAt: row.acknowledged_at
        ? new Date(row.acknowledged_at as string)
        : null,
      createdAt: new Date(row.created_at as string),
    };
  }

  private toPoLine(row: Record<string, unknown>): PoLineRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      poId: String(row.po_id),
      variantId: String(row.variant_id),
      quantity: Number(row.quantity),
      unitCostMinor: Number(row.unit_cost_minor),
      receivedQty: Number(row.received_qty),
    };
  }
}
