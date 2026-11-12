import { createHash } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export type DeductionType =
  "delivery_fee" | "return_fee" | "cod_commission" | "storage" | "other";

export const DEDUCTION_TYPES: DeductionType[] = [
  "delivery_fee",
  "return_fee",
  "cod_commission",
  "storage",
  "other",
];

export interface SettlementLine {
  trackingNumber: string;
  amountMinor: number;
  currency: string;
  deductionType?: DeductionType;
  deductionMinor?: number;
}

export interface SettlementParser {
  carrier: string;
  /** Returns the lines in a file, or null when this carrier is not the
   * file's format. */
  parse(content: string): SettlementLine[] | null;
}

/** CSV settlement format shared by the pilot couriers. */
export function csvSettlementParser(carrier: string): SettlementParser {
  return {
    carrier,
    parse(content: string): SettlementLine[] | null {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length < 2) return null;
      const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
      const trackingIndex = header.findIndex(
        (h) => h === "tracking" || h === "tracking_number" || h === "awb",
      );
      const amountIndex = header.findIndex(
        (h) => h === "amount" || h === "cod_amount" || h === "net",
      );
      if (trackingIndex === -1 || amountIndex === -1) return null;
      const currencyIndex = header.indexOf("currency");
      const deductionIndex = header.indexOf("deduction_type");
      const deductionAmountIndex = header.indexOf("deduction_amount");

      const out: SettlementLine[] = [];
      for (let i = 1; i < lines.length; i++) {
        const raw = lines[i];
        if (!raw) continue;
        const cols = raw.split(",");
        const tracking = (cols[trackingIndex] ?? "").trim();
        if (!tracking) continue;
        const amount = parseInt((cols[amountIndex] ?? "0").trim() || "0", 10);
        const deductionType = (cols[deductionIndex] ?? "").trim();
        out.push({
          trackingNumber: tracking,
          amountMinor: Number.isFinite(amount) ? amount : 0,
          currency: (cols[currencyIndex] ?? "EGP").trim() || "EGP",
          ...(DEDUCTION_TYPES.includes(deductionType as DeductionType)
            ? { deductionType: deductionType as DeductionType }
            : {}),
          ...(deductionAmountIndex === -1
            ? {}
            : {
                deductionMinor:
                  parseInt(
                    (cols[deductionAmountIndex] ?? "0").trim() || "0",
                    10,
                  ) || 0,
              }),
        });
      }
      return out;
    },
  };
}

export interface SettlementImportResult {
  fileId: string;
  imported: number;
  matched: number;
  unmatched: number;
  duplicate: boolean;
  totalDeductionMinor: number;
}

export class SettlementError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "SettlementError";
    this.statusCode = statusCode;
  }
}

export class SettlementService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
      parsers: SettlementParser[];
    },
  ) {}

  /**
   * Imports a settlement file. The file hash makes the import idempotent:
   * importing the same file twice creates no duplicates.
   */
  async importFile(
    tenantId: string,
    input: { content: string; carrier: string },
  ): Promise<SettlementImportResult> {
    const parser = this.deps.parsers.find((p) => p.carrier === input.carrier);
    if (!parser) {
      throw new SettlementError(
        `No settlement parser for ${input.carrier}.`,
        400,
      );
    }
    const lines = parser.parse(input.content);
    if (lines === null) {
      throw new SettlementError(
        `The file does not look like a ${input.carrier} settlement file.`,
        400,
      );
    }

    const fileHash = createHash("sha256").update(input.content).digest("hex");
    const existing = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<{ id: string }>(
          `select id from settlement_files where tenant_id=$1 and file_hash=$2`,
          [tenantId, fileHash],
        );
        return r.rows[0];
      },
    );
    if (existing) {
      return {
        fileId: existing.id,
        imported: 0,
        matched: 0,
        unmatched: 0,
        duplicate: true,
        totalDeductionMinor: 0,
      };
    }

    const fileId = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<{ id: string }>(
          `insert into settlement_files (tenant_id, file_hash, carrier, line_count)
         values ($1,$2,$3,$4) returning id`,
          [tenantId, fileHash, input.carrier, lines.length],
        );
        const id = r.rows[0]!.id;
        for (const line of lines) {
          const order = await client.query<{ id: string }>(
            `select o.id from shipments s join orders o on o.id = s.order_id
            where s.tenant_id=$1 and s.tracking_number=$2 limit 1`,
            [tenantId, line.trackingNumber],
          );
          await client.query(
            `insert into settlement_lines
             (tenant_id, file_id, tracking_number, order_id, amount_minor, currency, deduction_type, deduction_minor)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              tenantId,
              id,
              line.trackingNumber,
              order.rows[0]?.id ?? null,
              line.amountMinor,
              line.currency,
              line.deductionType ?? null,
              line.deductionMinor ?? 0,
            ],
          );
        }
        return id;
      },
    );

    const summary = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query<{
          matched: string;
          unmatched: string;
          deduction: string;
        }>(
          `select count(*) filter (where order_id is not null)::text as matched,
                count(*) filter (where order_id is null)::text as unmatched,
                coalesce(sum(deduction_minor),0)::text as deduction
           from settlement_lines where tenant_id=$1 and file_id=$2`,
          [tenantId, fileId],
        );
        const row = r.rows[0]!;
        return {
          matched: Number(row.matched),
          unmatched: Number(row.unmatched),
          totalDeductionMinor: Number(row.deduction),
        };
      },
    );

    return {
      fileId,
      imported: lines.length,
      matched: summary.matched,
      unmatched: summary.unmatched,
      duplicate: false,
      totalDeductionMinor: summary.totalDeductionMinor,
    };
  }

  /** Daily reconciliation: expected COD vs collected vs remitted. */
  async reconcile(
    tenantId: string,
    date: Date,
  ): Promise<{
    date: string;
    expectedMinor: number;
    collectedMinor: number;
    remittedMinor: number;
    unmatched: number;
    varianceMinor: number;
  }> {
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const expected = await client.query<{ total: string }>(
        `select coalesce(sum(p.amount_minor),0)::text as total
           from payments p join orders o on o.id=p.order_id
          where p.tenant_id=$1 and p.method='cod'
            and o.created_at >= $2 and o.created_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      const collected = await client.query<{ total: string }>(
        `select coalesce(sum(amount_minor),0)::text as total
           from settlement_lines sl join settlement_files f on f.id=sl.file_id
          where sl.tenant_id=$1 and sl.order_id is not null
            and f.imported_at >= $2 and f.imported_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      const unmatched = await client.query<{ total: string }>(
        `select count(*)::text as total
           from settlement_lines sl join settlement_files f on f.id=sl.file_id
          where sl.tenant_id=$1 and sl.order_id is null
            and f.imported_at >= $2 and f.imported_at < $3`,
        [tenantId, dayStart, dayEnd],
      );
      const expectedMinor = Number(expected.rows[0]?.total ?? 0);
      const collectedMinor = Number(collected.rows[0]?.total ?? 0);
      return {
        date: dayStart.toISOString().slice(0, 10),
        expectedMinor,
        collectedMinor,
        remittedMinor: collectedMinor,
        unmatched: Number(unmatched.rows[0]?.total ?? 0),
        varianceMinor: collectedMinor - expectedMinor,
      };
    });
  }
}
