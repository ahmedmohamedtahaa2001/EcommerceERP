import { withTenant } from "@ops-hub/db";
import { appendOutboxEvent } from "@ops-hub/events";
import type { Pool } from "pg";

import type {
  ProductKind,
  ProductRecord,
  ProductStatus,
  ProductStore,
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
            images, status, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
        [
          record.id,
          record.tenantId,
          record.kind,
          record.nameAr,
          record.nameEn,
          record.descriptionAr,
          record.descriptionEn,
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

  async list(tenantId: string): Promise<ProductRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ProductRow>(
        `select * from products where tenant_id = $1
          order by created_at desc, id desc`,
        [tenantId],
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
           images = coalesce($9::jsonb, images),
           status = coalesce($10, status),
           updated_at = $11
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
           (id, tenant_id, product_id, sku, attributes, images, created_at, updated_at)
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
        [
          record.id,
          record.tenantId,
          record.productId,
          record.sku,
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
    fields: Partial<Pick<VariantRecord, "attributes" | "images">>,
    updatedAt: Date,
  ): Promise<VariantRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<VariantRow>(
        `update variants set
           attributes = coalesce($3::jsonb, attributes),
           images = coalesce($4::jsonb, images),
           updated_at = $5
         where tenant_id = $1 and id = $2
         returning *`,
        [
          tenantId,
          id,
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
