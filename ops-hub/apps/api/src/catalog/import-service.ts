import { randomUUID } from "node:crypto";

import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import { PRODUCT_KINDS, PRODUCT_STATUSES } from "./types";
import type { ImportRow } from "./import-parse";

const MAX_NAME_LENGTH = 300;
const MAX_SKU_LENGTH = 100;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_ROWS_PER_IMPORT = 20_000;

export interface ImportRowError {
  row: number;
  reason: string;
}

export interface ImportResult {
  totalRows: number;
  createdCount: number;
  dryRun: boolean;
  errors: ImportRowError[];
}

interface ValidRow {
  row: number;
  productId: string;
  kind: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  productImages: string[];
  status: string;
  sku: string;
  attributes: Record<string, string>;
  variantImages: string[];
}

function parseJsonObject(
  raw: string,
  field: string,
): Record<string, string> | { error: string } {
  if (raw === "") {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      Object.values(parsed).some((value) => typeof value !== "string")
    ) {
      return { error: `${field} must be a JSON object of strings.` };
    }
    return parsed as Record<string, string>;
  } catch {
    return { error: `${field} must be valid JSON.` };
  }
}

function parseImageList(raw: string): string[] {
  if (raw === "") {
    return [];
  }
  return raw
    .split("|")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

/** Validates one row in isolation (no DB access); returns the row or a reason. */
function validateRow(
  row: ImportRow,
): { ok: true; value: ValidRow } | { ok: false; reason: string } {
  const v = row.values;

  const nameEn = v.nameEn ?? "";
  const nameAr = v.nameAr ?? "";
  if (nameEn.trim() === "") {
    return { ok: false, reason: "nameEn is required." };
  }
  if (nameEn.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      reason: `nameEn must be at most ${MAX_NAME_LENGTH} characters.`,
    };
  }
  if (nameAr.trim() === "") {
    return { ok: false, reason: "nameAr is required." };
  }
  if (nameAr.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      reason: `nameAr must be at most ${MAX_NAME_LENGTH} characters.`,
    };
  }

  const sku = (v.sku ?? "").trim();
  if (sku === "" || sku.length > MAX_SKU_LENGTH || !SKU_PATTERN.test(sku)) {
    return {
      ok: false,
      reason:
        "sku must be 1-100 characters, starting alphanumeric, using only letters, digits, '.', '_' and '-'.",
    };
  }

  const kind = v.kind?.trim() || "simple";
  if (!(PRODUCT_KINDS as readonly string[]).includes(kind)) {
    return {
      ok: false,
      reason: `kind must be one of: ${PRODUCT_KINDS.join(", ")}.`,
    };
  }

  const status = v.status?.trim() || "draft";
  if (!(PRODUCT_STATUSES as readonly string[]).includes(status)) {
    return {
      ok: false,
      reason: `status must be one of: ${PRODUCT_STATUSES.join(", ")}.`,
    };
  }

  const attributes = parseJsonObject(v.attributes ?? "", "attributes");
  if ("error" in attributes) {
    return { ok: false, reason: attributes.error };
  }

  return {
    ok: true,
    value: {
      row: row.row,
      productId: randomUUID(),
      kind,
      nameAr,
      nameEn,
      descriptionAr: v.descriptionAr?.trim() || null,
      descriptionEn: v.descriptionEn?.trim() || null,
      productImages: parseImageList(v.productImages ?? ""),
      status,
      sku,
      attributes,
      variantImages: parseImageList(v.variantImages ?? ""),
    },
  };
}

/**
 * Bulk-imports products with their one implicit variant. Each row becomes
 * one product (`kind` from the row, default `simple`) and one variant
 * carrying its `sku`. Validation never touches the database; only the
 * per-tenant existing-SKU check and the final insert do.
 */
export class CatalogImportService {
  constructor(private readonly pool: Pool) {}

  async import(
    rows: ImportRow[],
    tenantId: string,
    options: { dryRun: boolean; now: Date },
  ): Promise<ImportResult> {
    if (rows.length > MAX_ROWS_PER_IMPORT) {
      throw new Error(
        `A single import supports at most ${MAX_ROWS_PER_IMPORT} rows.`,
      );
    }

    const errors: ImportRowError[] = [];
    const valid: ValidRow[] = [];
    const seenSkus = new Map<string, number>();

    for (const row of rows) {
      const result = validateRow(row);
      if (!result.ok) {
        errors.push({ row: row.row, reason: result.reason });
        continue;
      }
      const firstSeenAt = seenSkus.get(result.value.sku);
      if (firstSeenAt !== undefined) {
        errors.push({
          row: row.row,
          reason: `duplicate sku in file: already used on row ${firstSeenAt}.`,
        });
        continue;
      }
      seenSkus.set(result.value.sku, row.row);
      valid.push(result.value);
    }

    if (valid.length === 0) {
      return {
        totalRows: rows.length,
        createdCount: 0,
        dryRun: options.dryRun,
        errors,
      };
    }

    const existing = await withTenant(this.pool, tenantId, (client) =>
      client.query<{ sku: string }>(
        `select sku from variants where tenant_id = $1 and sku = any($2::text[])`,
        [tenantId, valid.map((row) => row.sku)],
      ),
    );
    const existingSkus = new Set(existing.rows.map((row) => row.sku));

    const toInsert = valid.filter((row) => {
      if (existingSkus.has(row.sku)) {
        errors.push({ row: row.row, reason: `sku already exists: ${row.sku}` });
        return false;
      }
      return true;
    });

    if (options.dryRun || toInsert.length === 0) {
      return {
        totalRows: rows.length,
        createdCount: 0,
        dryRun: options.dryRun,
        errors,
      };
    }

    await withTenant(this.pool, tenantId, (client) =>
      bulkInsert(client, tenantId, toInsert, options.now),
    );

    return {
      totalRows: rows.length,
      createdCount: toInsert.length,
      dryRun: false,
      errors,
    };
  }
}

async function bulkInsert(
  client: { query: (text: string, values: unknown[]) => Promise<unknown> },
  tenantId: string,
  rows: ValidRow[],
  now: Date,
): Promise<void> {
  const productValues: unknown[] = [];
  const productPlaceholders: string[] = [];
  const variantValues: unknown[] = [];
  const variantPlaceholders: string[] = [];

  rows.forEach((row, index) => {
    const pBase = index * 11;
    productPlaceholders.push(
      `($${pBase + 1}, $${pBase + 2}, $${pBase + 3}, $${pBase + 4}, $${pBase + 5}, $${pBase + 6}, $${pBase + 7}, $${pBase + 8}::jsonb, $${pBase + 9}, $${pBase + 10}, $${pBase + 11})`,
    );
    productValues.push(
      row.productId,
      tenantId,
      row.kind,
      row.nameAr,
      row.nameEn,
      row.descriptionAr,
      row.descriptionEn,
      JSON.stringify(row.productImages),
      row.status,
      now,
      now,
    );

    const vBase = index * 8;
    const variantId = randomUUID();
    variantPlaceholders.push(
      `($${vBase + 1}, $${vBase + 2}, $${vBase + 3}, $${vBase + 4}, $${vBase + 5}::jsonb, $${vBase + 6}::jsonb, $${vBase + 7}, $${vBase + 8})`,
    );
    variantValues.push(
      variantId,
      tenantId,
      row.productId,
      row.sku,
      JSON.stringify(row.attributes),
      JSON.stringify(row.variantImages),
      now,
      now,
    );
  });

  await client.query(
    `insert into products
       (id, tenant_id, kind, name_ar, name_en, description_ar, description_en,
        images, status, created_at, updated_at)
     values ${productPlaceholders.join(", ")}`,
    productValues,
  );
  await client.query(
    `insert into variants
       (id, tenant_id, product_id, sku, attributes, images, created_at, updated_at)
     values ${variantPlaceholders.join(", ")}`,
    variantValues,
  );
}
