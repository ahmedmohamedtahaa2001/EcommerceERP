import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type {
  BundleComponentRecord,
  CatalogStore,
  ProductRecord,
  VariantRecord,
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

interface BundleComponentRow {
  id: string;
  tenant_id: string;
  bundle_product_id: string;
  component_variant_id: string;
  quantity: number;
}

function toProduct(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind as ProductRecord["kind"],
    nameAr: row.name_ar,
    nameEn: row.name_en,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    images: row.images ?? [],
    status: row.status as ProductRecord["status"],
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
    attributes: row.attributes ?? {},
    images: row.images ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toComponent(row: BundleComponentRow): BundleComponentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    bundleProductId: row.bundle_product_id,
    componentVariantId: row.component_variant_id,
    quantity: row.quantity,
  };
}

export class PgCatalogStore implements CatalogStore {
  constructor(private readonly pool: Pool) {}

  async createProduct(product: ProductRecord): Promise<void> {
    await withTenant(this.pool, product.tenantId, (client) =>
      client.query(
        `insert into products
           (id, tenant_id, kind, name_ar, name_en, description_ar, description_en,
            images, status, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)`,
        [
          product.id,
          product.tenantId,
          product.kind,
          product.nameAr,
          product.nameEn,
          product.descriptionAr,
          product.descriptionEn,
          JSON.stringify(product.images),
          product.status,
          product.createdAt,
          product.updatedAt,
        ],
      ),
    );
  }

  async getProduct(tenantId: string, id: string): Promise<ProductRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ProductRow>(
        `select * from products where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toProduct(row) : null;
    });
  }

  async listProducts(
    tenantId: string,
    limit: number,
    offset: number,
  ): Promise<ProductRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ProductRow>(
        `select * from products
          where tenant_id = $1
          order by created_at desc, id desc
          limit $2 offset $3`,
        [tenantId, limit, offset],
      );
      return result.rows.map(toProduct);
    });
  }

  async updateProduct(product: ProductRecord): Promise<boolean> {
    return withTenant(this.pool, product.tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `update products
            set kind = $3,
                name_ar = $4,
                name_en = $5,
                description_ar = $6,
                description_en = $7,
                images = $8::jsonb,
                status = $9,
                updated_at = $10
          where id = $1
            and tenant_id = $2
          returning id`,
        [
          product.id,
          product.tenantId,
          product.kind,
          product.nameAr,
          product.nameEn,
          product.descriptionAr,
          product.descriptionEn,
          JSON.stringify(product.images),
          product.status,
          product.updatedAt,
        ],
      );
      return result.rowCount === 1;
    });
  }

  async deleteProduct(
    tenantId: string,
    id: string,
  ): Promise<"deleted" | "has_stock" | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      try {
        const result = await client.query<{ id: string }>(
          `delete from products
            where id = $2 and tenant_id = $1
            returning id`,
          [tenantId, id],
        );
        if (result.rowCount !== 1) return null;
        return "deleted";
      } catch (error) {
        if ((error as { code?: string }).code === "23503") {
          return "has_stock";
        }
        throw error;
      }
    });
  }

  async createVariant(variant: VariantRecord): Promise<void> {
    await withTenant(this.pool, variant.tenantId, (client) =>
      client.query(
        `insert into variants
           (id, tenant_id, product_id, sku, attributes, images, created_at, updated_at)
         values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)`,
        [
          variant.id,
          variant.tenantId,
          variant.productId,
          variant.sku,
          JSON.stringify(variant.attributes),
          JSON.stringify(variant.images),
          variant.createdAt,
          variant.updatedAt,
        ],
      ),
    );
  }

  async getVariant(tenantId: string, id: string): Promise<VariantRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<VariantRow>(
        `select * from variants where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toVariant(row) : null;
    });
  }

  async listVariantsByProduct(
    tenantId: string,
    productId: string,
  ): Promise<VariantRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<VariantRow>(
        `select * from variants
          where tenant_id = $1 and product_id = $2
          order by created_at asc, id asc`,
        [tenantId, productId],
      );
      return result.rows.map(toVariant);
    });
  }

  async updateVariant(variant: VariantRecord): Promise<boolean> {
    return withTenant(this.pool, variant.tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `update variants
            set sku = $3,
                attributes = $4::jsonb,
                images = $5::jsonb,
                updated_at = $6
          where id = $1
            and tenant_id = $2
          returning id`,
        [
          variant.id,
          variant.tenantId,
          variant.sku,
          JSON.stringify(variant.attributes),
          JSON.stringify(variant.images),
          variant.updatedAt,
        ],
      );
      return result.rowCount === 1;
    });
  }

  async deleteVariant(
    tenantId: string,
    id: string,
  ): Promise<"deleted" | "has_stock" | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      try {
        const result = await client.query<{ id: string }>(
          `delete from variants
            where id = $2 and tenant_id = $1
            returning id`,
          [tenantId, id],
        );
        if (result.rowCount !== 1) return null;
        return "deleted";
      } catch (error) {
        if ((error as { code?: string }).code === "23503") {
          return "has_stock";
        }
        throw error;
      }
    });
  }

  async hasStockMovements(tenantId: string, variantId: string): Promise<boolean> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<{ exists: boolean }>(
        `select exists(
           select 1 from stock_movements
            where tenant_id = $1 and variant_id = $2
         ) as exists`,
        [tenantId, variantId],
      );
      return result.rows[0]?.exists === true;
    });
  }

  async replaceComponents(
    tenantId: string,
    bundleProductId: string,
    components: BundleComponentRecord[],
  ): Promise<void> {
    await withTenant(this.pool, tenantId, async (client) => {
      await client.query("begin");
      try {
        await client.query(
          `delete from bundle_components
            where tenant_id = $1 and bundle_product_id = $2`,
          [tenantId, bundleProductId],
        );
        for (const component of components) {
          await client.query(
            `insert into bundle_components
               (id, tenant_id, bundle_product_id, component_variant_id, quantity)
             values ($1,$2,$3,$4,$5)`,
            [
              component.id,
              tenantId,
              bundleProductId,
              component.componentVariantId,
              component.quantity,
            ],
          );
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });
  }

  async listComponents(
    tenantId: string,
    bundleProductId: string,
  ): Promise<BundleComponentRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<BundleComponentRow>(
        `select * from bundle_components
          where tenant_id = $1 and bundle_product_id = $2
          order by id asc`,
        [tenantId, bundleProductId],
      );
      return result.rows.map(toComponent);
    });
  }
}
