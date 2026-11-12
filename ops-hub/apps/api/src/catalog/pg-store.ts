import { withTenant } from "@ops-hub/db";
import { appendOutboxEvent } from "@ops-hub/events";
import type { Pool } from "pg";

import type {
  ProductKind,
  ProductRecord,
  ProductStatus,
  ProductStore,
  VariantDimensions,
  VariantRecord,
  VariantStore,
} from "./types";

interface ProductRow {
  id: string;
  tenant_id: string;
  kind: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  category: string | null;
  brand: string | null;
  tags: string[];
  is_hazardous: boolean;
  images: string[];
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface VariantRow {
  id: string;
  tenant_id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  weight_grams: number | null;
  dimensions: VariantDimensions;
  price_minor: number | null;
  currency: string;
  attributes: Record<string, string>;
  images: string[];
  created_at: Date;
  updated_at: Date;
}

function toProduct(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind as ProductKind,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    category: row.category,
    brand: row.brand,
    tags: row.tags,
    isHazardous: row.is_hazardous,
    images: row.images,
    status: row.status as ProductStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVariant(row: VariantRow): VariantRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    productId: row.product_id,
    sku: row.sku,
    barcode: row.barcode,
    weightGrams: row.weight_grams,
    dimensions: row.dimensions,
    priceMinor: row.price_minor,
    currency: row.currency,
    attributes: row.attributes,
    images: row.images,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgProductStore implements ProductStore {
  constructor(private readonly pool: Pool) {}

  async create(record: ProductRecord): Promise<void> {
    await withTenant(this.pool, record.tenantId, async (client) => {
      await client.query(
        `insert into products
           (id, tenant_id, kind, name_ar, name_en, description_ar, description_en,
            category, brand, tags, is_hazardous, images, status, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12::jsonb, $13, $14, $15)`,
        [
          record.id,
          record.tenantId,
          record.kind,
          record.nameAr,
          record.nameEn,
          record.descriptionAr,
          record.descriptionEn,
          record.category,
          record.brand,
          JSON.stringify(record.tags),
          record.isHazardous,
          JSON.stringify(record.images),
          record.status,
          record.createdAt,
          record.updatedAt,
        ],
      );
      // Same transaction, same client: if either write fails, both roll
      // back together — the outbox can never record an event for a
      // product that doesn't exist, or vice versa.
      await appendOutboxEvent(client, {
        tenantId: record.tenantId,
        eventType: "product.created",
        payload: record,
      });
    });
  }

  async getById(tenantId: string, id: string): Promise<ProductRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ProductRow>(
        `select * from products where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toProduct(row) : null;
    });
  }

  async list(
    tenantId: string,
    filter: {
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    } = {},
  ): Promise<ProductRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.cursor) {
        params.push(filter.cursor.createdAt, filter.cursor.id);
        conditions.push("(created_at, id) < ($2::timestamptz, $3::uuid)");
      }
      if (filter.limit !== undefined) {
        params.push(filter.limit);
        conditions.push(`true`);
        const limitParam = params.length;
        const result = await client.query<ProductRow>(
          `select * from products where ${conditions.join(" and ")}
            order by created_at desc, id desc
            limit $${limitParam}`,
          params,
        );
        return result.rows.map(toProduct);
      }
      const result = await client.query<ProductRow>(
        `select * from products where ${conditions.join(" and ")}
          order by created_at desc, id desc`,
        params,
      );
      return result.rows.map(toProduct);
    });
  }

  async update(
    tenantId: string,
    id: string,
    fields: Partial<
      Pick<
        ProductRecord,
        | "nameAr"
        | "nameEn"
        | "descriptionAr"
        | "descriptionEn"
        | "category"
        | "brand"
        | "tags"
        | "isHazardous"
        | "images"
        | "status"
      >
    >,
    updatedAt: Date,
  ): Promise<ProductRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ProductRow>(
        `update products set
           name_ar = coalesce($3, name_ar),
           name_en = coalesce($4, name_en),
           description_ar = case when $5 then $6 else description_ar end,
           description_en = case when $7 then $8 else description_en end,
           category = case when $9 then $10 else category end,
           brand = case when $11 then $12 else brand end,
           tags = coalesce($13::jsonb, tags),
           is_hazardous = coalesce($14, is_hazardous),
           images = coalesce($15::jsonb, images),
           status = coalesce($16, status),
           updated_at = $17
         where tenant_id = $1 and id = $2
         returning *`,
        [
          tenantId,
          id,
          fields.nameAr ?? null,
          fields.nameEn ?? null,
          "descriptionAr" in fields,
          fields.descriptionAr ?? null,
          "descriptionEn" in fields,
          fields.descriptionEn ?? null,
          "category" in fields,
          fields.category ?? null,
          "brand" in fields,
          fields.brand ?? null,
          fields.tags !== undefined ? JSON.stringify(fields.tags) : null,
          fields.isHazardous ?? null,
          fields.images !== undefined ? JSON.stringify(fields.images) : null,
          fields.status ?? null,
          updatedAt,
        ],
      );
      const row = result.rows[0];
      return row ? toProduct(row) : null;
    });
  }
}

export class PgVariantStore implements VariantStore {
  constructor(private readonly pool: Pool) {}

  async create(record: VariantRecord): Promise<void> {
    await withTenant(this.pool, record.tenantId, (client) =>
      client.query(
        `insert into variants
           (id, tenant_id, product_id, sku, barcode, weight_grams, dimensions,
            price_minor, currency, attributes, images, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, $12, $13)`,
        [
          record.id,
          record.tenantId,
          record.productId,
          record.sku,
          record.barcode,
          record.weightGrams,
          JSON.stringify(record.dimensions),
          record.priceMinor,
          record.currency,
          JSON.stringify(record.attributes),
          JSON.stringify(record.images),
          record.createdAt,
          record.updatedAt,
        ],
      ),
    );
  }

  async getById(tenantId: string, id: string): Promise<VariantRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<VariantRow>(
        `select * from variants where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toVariant(row) : null;
    });
  }

  async getBySku(tenantId: string, sku: string): Promise<VariantRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<VariantRow>(
        `select * from variants where tenant_id = $1 and sku = $2`,
        [tenantId, sku],
      );
      const row = result.rows[0];
      return row ? toVariant(row) : null;
    });
  }

  async listByProduct(
    tenantId: string,
    productId: string,
  ): Promise<VariantRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<VariantRow>(
        `select * from variants where tenant_id = $1 and product_id = $2
          order by created_at asc, id asc`,
        [tenantId, productId],
      );
      return result.rows.map(toVariant);
    });
  }

  async update(
    tenantId: string,
    id: string,
    fields: Partial<
      Pick<
        VariantRecord,
        | "barcode"
        | "weightGrams"
        | "dimensions"
        | "priceMinor"
        | "currency"
        | "attributes"
        | "images"
      >
    >,
    updatedAt: Date,
  ): Promise<VariantRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<VariantRow>(
        `update variants set
           barcode = case when $3 then $4 else barcode end,
           weight_grams = case when $5 then $6::integer else weight_grams end,
           dimensions = coalesce($7::jsonb, dimensions),
           price_minor = case when $8 then $9::integer else price_minor end,
           currency = coalesce($10, currency),
           attributes = coalesce($11::jsonb, attributes),
           images = coalesce($12::jsonb, images),
           updated_at = $13
         where tenant_id = $1 and id = $2
         returning *`,
        [
          tenantId,
          id,
          "barcode" in fields,
          fields.barcode ?? null,
          "weightGrams" in fields,
          fields.weightGrams ?? null,
          fields.dimensions !== undefined
            ? JSON.stringify(fields.dimensions)
            : null,
          "priceMinor" in fields,
          fields.priceMinor ?? null,
          fields.currency ?? null,
          fields.attributes !== undefined
            ? JSON.stringify(fields.attributes)
            : null,
          fields.images !== undefined ? JSON.stringify(fields.images) : null,
          updatedAt,
        ],
      );
      const row = result.rows[0];
      return row ? toVariant(row) : null;
    });
  }
}
