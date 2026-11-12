import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

import { StockService } from "../stock/service";
import type { MovementActor, StockStore } from "../stock/types";

export type ReceiptStatus = "received" | "released";
export type CycleClassification = "A" | "B" | "C";
export type CycleCountStatus = "open" | "counted" | "approved" | "adjusted";

export interface ReceiptLineRecord {
  id: string;
  tenantId: string;
  receiptId: string;
  variantId: string;
  sku: string;
  expectedQty: number | null;
  receivedQty: number;
  damagedQty: number;
  substitutionSku: string | null;
  releasedBinId: string | null;
  releasedQty: number;
}

export interface ReceiptRecord {
  id: string;
  tenantId: string;
  poId: string | null;
  locationId: string;
  status: ReceiptStatus;
  receivedAt: Date;
  releasedAt: Date | null;
  createdAt: Date;
}

export interface CycleCountRecord {
  id: string;
  tenantId: string;
  locationId: string;
  variantId: string;
  classification: CycleClassification;
  status: CycleCountStatus;
  expectedQty: number;
  countedQty: number | null;
  approvedBy: string | null;
  createdAt: Date;
  countedAt: Date | null;
}

export class ReceivingError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "ReceivingError";
    this.statusCode = statusCode;
  }
}

/**
 * Receiving, putaway and cycle counts (roadmap Sprint 6).
 *
 * Every received unit lands in `quarantined`. Releasing it to `on_hand`
 * needs a matching SKU scan and a bin scan; the movement happens through the
 * stock ledger so balances stay derived.
 */
export class ReceivingService {
  constructor(
    private readonly deps: {
      pool: Pool;
      stock: StockService;
      store: StockStore;
      clock: { now(): Date };
    },
  ) {}

  async createReceipt(
    tenantId: string,
    input: {
      locationId: string;
      poId?: string | null;
      lines: {
        variantId: string;
        sku: string;
        expectedQty?: number | null;
        receivedQty: number;
        damagedQty?: number;
        substitutionSku?: string | null;
      }[];
    },
    actor: MovementActor | null,
  ): Promise<{ receipt: ReceiptRecord; lines: ReceiptLineRecord[] }> {
    if (input.lines.length === 0) {
      throw new ReceivingError("A receipt needs at least one line.");
    }
    for (const line of input.lines) {
      if (!Number.isInteger(line.receivedQty) || line.receivedQty < 0) {
        throw new ReceivingError("receivedQty must be a non-negative integer.");
      }
    }

    const receiptId = randomUUID();
    const now = this.deps.clock.now();

    const lines = await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into receipts (id, tenant_id, po_id, location_id, status, received_at)
         values ($1,$2,$3,$4,'received',$5)`,
        [receiptId, tenantId, input.poId ?? null, input.locationId, now],
      );
      const created: ReceiptLineRecord[] = [];
      for (const line of input.lines) {
        const r = await client.query<{
          id: string;
          tenant_id: string;
          receipt_id: string;
          variant_id: string;
          expected_qty: number | null;
          received_qty: number;
          damaged_qty: number;
          substitution_sku: string | null;
          released_bin_id: string | null;
          released_qty: number;
        }>(
          `insert into receipt_lines
             (id, tenant_id, receipt_id, variant_id, expected_qty, received_qty, damaged_qty, substitution_sku)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
          [
            randomUUID(),
            tenantId,
            receiptId,
            line.variantId,
            line.expectedQty ?? null,
            line.receivedQty,
            line.damagedQty ?? 0,
            line.substitutionSku ?? null,
          ],
        );
        const row = r.rows[0]!;
        created.push({
          id: row.id,
          tenantId: row.tenant_id,
          receiptId: row.receipt_id,
          variantId: row.variant_id,
          sku: line.sku,
          expectedQty: row.expected_qty,
          receivedQty: row.received_qty,
          damagedQty: row.damaged_qty,
          substitutionSku: row.substitution_sku,
          releasedBinId: row.released_bin_id,
          releasedQty: row.released_qty,
        });
      }
      return created;
    });

    // Every received unit is quarantined first — never on_hand directly.
    for (const line of lines) {
      if (line.receivedQty > 0) {
        await this.deps.stock.recordMovement(
          {
            variantId: line.variantId,
            locationId: input.locationId,
            bucket: "quarantined",
            delta: line.receivedQty,
            reason: "RECEIPT",
            reference: receiptId,
          },
          tenantId,
          actor,
        );
      }
      if (line.damagedQty > 0) {
        await this.deps.stock.recordMovement(
          {
            variantId: line.variantId,
            locationId: input.locationId,
            bucket: "damaged",
            delta: line.damagedQty,
            reason: "RECEIPT_DAMAGE",
            reference: receiptId,
          },
          tenantId,
          actor,
        );
      }
    }

    const receipt: ReceiptRecord = {
      id: receiptId,
      tenantId,
      poId: input.poId ?? null,
      locationId: input.locationId,
      status: "received",
      receivedAt: now,
      releasedAt: null,
      createdAt: now,
    };
    return { receipt, lines };
  }

  async listReceipts(tenantId: string): Promise<ReceiptRecord[]> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `select * from receipts where tenant_id=$1 order by received_at desc`,
        [tenantId],
      );
      return r.rows.map((row) => ({
        id: String(row.id),
        tenantId: String(row.tenant_id),
        poId: row.po_id === null ? null : String(row.po_id),
        locationId: String(row.location_id),
        status: row.status as ReceiptStatus,
        receivedAt: new Date(row.received_at as string),
        releasedAt: row.released_at
          ? new Date(row.released_at as string)
          : null,
        createdAt: new Date(row.created_at as string),
      }));
    });
  }

  /**
   * Releases quarantined units into a bin. The SKU scan must match the line
   * and the bin must exist in this tenant.
   */
  async releaseToBin(
    tenantId: string,
    input: {
      receiptId: string;
      lineId: string;
      scannedSku: string;
      binCode: string;
      quantity: number;
    },
    actor: MovementActor | null,
  ): Promise<ReceiptLineRecord> {
    const line = await this.getLine(tenantId, input.lineId);
    if (!line || line.receiptId !== input.receiptId) {
      throw new ReceivingError("Receipt line not found.", 404);
    }
    if (line.sku !== input.scannedSku) {
      throw new ReceivingError(
        `SKU scan mismatch: expected ${line.sku}, scanned ${input.scannedSku}.`,
      );
    }
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new ReceivingError("quantity must be a positive integer.");
    }
    const remaining = line.receivedQty - line.releasedQty;
    if (input.quantity > remaining) {
      throw new ReceivingError(
        `Only ${remaining} unit(s) left to release on this line.`,
      );
    }

    const bin = await this.findBin(tenantId, input.binCode);
    if (!bin) {
      throw new ReceivingError(`Bin ${input.binCode} not found.`, 404);
    }

    await this.deps.stock.recordMovement(
      {
        variantId: line.variantId,
        locationId: bin.locationId,
        bucket: "quarantined",
        delta: -input.quantity,
        reason: "RECEIPT_RELEASE",
        reference: input.receiptId,
      },
      tenantId,
      actor,
    );
    await this.deps.stock.recordMovement(
      {
        variantId: line.variantId,
        locationId: bin.locationId,
        bucket: "on_hand",
        delta: input.quantity,
        reason: "RECEIPT_RELEASE",
        reference: input.receiptId,
      },
      tenantId,
      actor,
    );

    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into bin_stock (tenant_id, bin_id, variant_id, quantity)
         values ($1,$2,$3,$4)
         on conflict (tenant_id, bin_id, variant_id)
         do update set quantity = bin_stock.quantity + $4, updated_at = now()`,
        [tenantId, bin.id, line.variantId, input.quantity],
      );
    });

    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `update receipt_lines set released_bin_id=$3, released_qty=released_qty+$4
          where tenant_id=$1 and id=$2 returning *`,
        [tenantId, input.lineId, bin.id, input.quantity],
      );
      const row = r.rows[0]!;
      const all = await client.query<{ released: number; total: number }>(
        `select coalesce(sum(released_qty),0)::int as released,
                coalesce(sum(received_qty),0)::int as total
           from receipt_lines where tenant_id=$1 and receipt_id=$2`,
        [tenantId, input.receiptId],
      );
      if (all.rows[0] && all.rows[0].released >= all.rows[0].total) {
        await client.query(
          `update receipts set status='released', released_at=now()
            where tenant_id=$1 and id=$2`,
          [tenantId, input.receiptId],
        );
      }
      return {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        receiptId: String(row.receipt_id),
        variantId: String(row.variant_id),
        sku: line.sku,
        expectedQty:
          row.expected_qty === null ? null : Number(row.expected_qty),
        receivedQty: Number(row.received_qty),
        damagedQty: Number(row.damaged_qty),
        substitutionSku: (row.substitution_sku as string | null) ?? null,
        releasedBinId: (row.released_bin_id as string | null) ?? null,
        releasedQty: Number(row.released_qty),
      };
    });
  }

  /** Guided putaway: prefer a bin that already holds the SKU, else the
   * nearest free bin in the right zone, never a full one. */
  async suggestPutaway(
    tenantId: string,
    input: { variantId: string; locationId: string; zone?: string },
  ): Promise<{ binId: string; binCode: string; reason: string }> {
    const bins = await this.listBins(tenantId, input.locationId);
    if (bins.length === 0) {
      throw new ReceivingError("This location has no bins.", 404);
    }

    const sameSku = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<{ bin_id: string }>(
          `select distinct bin_id from bin_stock
          where tenant_id=$1 and variant_id=$2 and quantity > 0`,
          [tenantId, input.variantId],
        );
        return r.rows.map((row) => row.bin_id);
      },
    );

    for (const bin of bins) {
      if (sameSku.includes(bin.id)) {
        return {
          binId: bin.id,
          binCode: bin.code,
          reason: "already holds this SKU",
        };
      }
    }
    const zoneBins = input.zone
      ? bins.filter((b) => b.zone === input.zone)
      : bins;
    const free = (zoneBins.length > 0 ? zoneBins : bins).find(
      (b) => b.capacity === null || b.used < b.capacity,
    );
    if (!free) {
      throw new ReceivingError("Every bin in this location is full.", 409);
    }
    return {
      binId: free.id,
      binCode: free.code,
      reason: input.zone
        ? `nearest free bin in zone ${input.zone}`
        : "nearest free bin",
    };
  }

  async listCycleCounts(
    tenantId: string,
    filter: { status?: string; locationId?: string } = {},
  ): Promise<CycleCountRecord[]> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.status) {
        params.push(filter.status);
        conditions.push(`status = $${params.length}`);
      }
      if (filter.locationId) {
        params.push(filter.locationId);
        conditions.push(`location_id = $${params.length}`);
      }
      const r = await client.query<Record<string, unknown>>(
        `select * from cycle_counts where ${conditions.join(" and ")}
          order by created_at desc`,
        params,
      );
      return r.rows.map((row) => ({
        id: String(row.id),
        tenantId: String(row.tenant_id),
        locationId: String(row.location_id),
        variantId: String(row.variant_id),
        classification: row.classification as CycleClassification,
        status: row.status as CycleCountStatus,
        expectedQty: Number(row.expected_qty),
        countedQty: row.counted_qty === null ? null : Number(row.counted_qty),
        approvedBy: row.approved_by === null ? null : String(row.approved_by),
        createdAt: new Date(row.created_at as string),
        countedAt: row.counted_at ? new Date(row.counted_at as string) : null,
      }));
    });
  }

  /** Submitting a count only records it; the variance adjustment needs
   * approval (see `approveCycleCount`). */
  async submitCycleCount(
    tenantId: string,
    input: { cycleCountId: string; countedQty: number },
  ): Promise<CycleCountRecord> {
    if (!Number.isInteger(input.countedQty) || input.countedQty < 0) {
      throw new ReceivingError("countedQty must be a non-negative integer.");
    }
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `update cycle_counts set counted_qty=$3, counted_at=now(), status='counted'
          where tenant_id=$1 and id=$2 and status='open'
          returning *`,
        [tenantId, input.cycleCountId, input.countedQty],
      );
      if (!r.rows[0]) {
        throw new ReceivingError(
          "Cycle count not found or already counted.",
          404,
        );
      }
      const row = r.rows[0];
      return {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        locationId: String(row.location_id),
        variantId: String(row.variant_id),
        classification: row.classification as CycleClassification,
        status: row.status as CycleCountStatus,
        expectedQty: Number(row.expected_qty),
        countedQty: Number(row.counted_qty),
        approvedBy: null,
        createdAt: new Date(row.created_at as string),
        countedAt: row.counted_at ? new Date(row.counted_at as string) : null,
      };
    });
  }

  /** Approving a counted cycle writes the `COUNT_VARIANCE` adjustment. */
  async approveCycleCount(
    tenantId: string,
    cycleCountId: string,
    approverId: string,
    actor: MovementActor | null,
  ): Promise<{ cycleCount: CycleCountRecord; variance: number }> {
    const row = await withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `select * from cycle_counts where tenant_id=$1 and id=$2`,
        [tenantId, cycleCountId],
      );
      if (!r.rows[0]) {
        throw new ReceivingError("Cycle count not found.", 404);
      }
      if (r.rows[0].status !== "counted") {
        throw new ReceivingError("Only a counted cycle can be approved.");
      }
      return r.rows[0];
    });

    const expectedQty = Number(row.expected_qty);
    const countedQty = Number(row.counted_qty);
    const variance = countedQty - expectedQty;
    if (variance !== 0) {
      await this.deps.stock.recordMovement(
        {
          variantId: String(row.variant_id),
          locationId: String(row.location_id),
          bucket: "on_hand",
          delta: variance,
          reason: "COUNT_VARIANCE",
          reference: cycleCountId,
        },
        tenantId,
        actor,
      );
    }

    const updated = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<Record<string, unknown>>(
          `update cycle_counts set status='adjusted', approved_by=$3
          where tenant_id=$1 and id=$2 returning *`,
          [tenantId, cycleCountId, approverId],
        );
        const updatedRow = r.rows[0]!;
        return {
          id: String(updatedRow.id),
          tenantId: String(updatedRow.tenant_id),
          locationId: String(updatedRow.location_id),
          variantId: String(updatedRow.variant_id),
          classification: updatedRow.classification as CycleClassification,
          status: updatedRow.status as CycleCountStatus,
          expectedQty: Number(updatedRow.expected_qty),
          countedQty: Number(updatedRow.counted_qty),
          approvedBy:
            updatedRow.approved_by === null
              ? null
              : String(updatedRow.approved_by),
          createdAt: new Date(updatedRow.created_at as string),
          countedAt: updatedRow.counted_at
            ? new Date(updatedRow.counted_at as string)
            : null,
        };
      },
    );
    return { cycleCount: updated, variance };
  }

  private async getLine(
    tenantId: string,
    lineId: string,
  ): Promise<ReceiptLineRecord | null> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{
        id: string;
        tenant_id: string;
        receipt_id: string;
        variant_id: string;
        expected_qty: number | null;
        received_qty: number;
        damaged_qty: number;
        substitution_sku: string | null;
        released_bin_id: string | null;
        released_qty: number;
      }>(
        `select rl.*, v.sku from receipt_lines rl
           join variants v on v.id = rl.variant_id
          where rl.tenant_id=$1 and rl.id=$2`,
        [tenantId, lineId],
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        tenantId: row.tenant_id,
        receiptId: row.receipt_id,
        variantId: row.variant_id,
        sku: (row as unknown as { sku: string }).sku,
        expectedQty: row.expected_qty,
        receivedQty: row.received_qty,
        damagedQty: row.damaged_qty,
        substitutionSku: row.substitution_sku,
        releasedBinId: row.released_bin_id,
        releasedQty: row.released_qty,
      };
    });
  }

  private async findBin(
    tenantId: string,
    code: string,
  ): Promise<{ id: string; locationId: string } | null> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{ id: string; location_id: string }>(
        `select id, location_id from bins where tenant_id=$1 and code=$2`,
        [tenantId, code],
      );
      const row = r.rows[0];
      return row ? { id: row.id, locationId: row.location_id } : null;
    });
  }

  private async listBins(
    tenantId: string,
    locationId: string,
  ): Promise<
    {
      id: string;
      code: string;
      zone: string | null;
      capacity: number | null;
      used: number;
    }[]
  > {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<{
        id: string;
        code: string;
        zone: string | null;
        capacity: number | null;
        used: string;
      }>(
        `select b.id, b.code, b.zone, b.capacity,
                coalesce((select sum(bs.quantity) from bin_stock bs
                           where bs.tenant_id=b.tenant_id and bs.bin_id=b.id),0)::text as used
           from bins b where b.tenant_id=$1 and b.location_id=$2
          order by b.code asc`,
        [tenantId, locationId],
      );
      return r.rows.map((row) => ({
        id: row.id,
        code: row.code,
        zone: row.zone,
        capacity: row.capacity,
        used: Number(row.used),
      }));
    });
  }
}

/**
 * ABC classification by value and velocity: `A` items are counted weekly,
 * `B` monthly, `C` quarterly.
 */
export function classifyAbc(
  rows: { valueMinor: number; unitsSold: number }[],
): "A" | "B" | "C" {
  const totalValue = rows.reduce((sum, r) => sum + r.valueMinor, 0);
  if (totalValue <= 0) return "C";
  const sorted = [...rows].sort((a, b) => b.valueMinor - a.valueMinor);
  let cumulative = 0;
  for (const row of sorted) {
    cumulative += row.valueMinor;
    if (cumulative / totalValue <= 0.8) return "A";
  }
  const totalUnits = rows.reduce((sum, r) => sum + r.unitsSold, 0);
  const highVelocity = rows.filter((r) => r.unitsSold > 0).length;
  if (totalUnits > 0 && highVelocity / rows.length > 0.5) return "B";
  return "C";
}
