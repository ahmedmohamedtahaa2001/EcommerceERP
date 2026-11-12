import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import { toCsv } from "./csv";

/** Above this, an export would be too large to open in a spreadsheet, so it is refused. */
export const MAX_EXPORT_ROWS = 50_000;

export type ExportResource = "orders" | "products" | "inventory" | "customers";

export interface ExportFile {
  resource: ExportResource;
  filename: string;
  csv: string;
  rowCount: number;
}

export class ExportTooLargeError extends Error {
  readonly statusCode = 422;
  readonly code = "export-too-large";

  constructor(resource: ExportResource) {
    super(
      `The ${resource} export has more than ${MAX_EXPORT_ROWS} rows. Export a smaller set, or contact support for a bulk export.`,
    );
    this.name = "ExportTooLargeError";
  }
}

interface Row {
  [column: string]: unknown;
}

export class ExportService {
  constructor(
    private readonly pool: Pool,
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  async exportOrders(tenantId: string): Promise<ExportFile> {
    const rows = await this.run(
      tenantId,
      "orders",
      `
      select o.order_number, o.created_at, o.status, o.channel, o.currency,
             o.total_minor, c.full_name as customer_name, c.phone as customer_phone,
             a.raw_governorate as governorate, p.method as payment_method,
             (select count(*)::int from order_lines l where l.order_id = o.id) as items_count
        from orders o
        join customers c on c.id = o.customer_id
        left join addresses a on a.id = o.address_id
        left join payments p on p.order_id = o.id
       where o.tenant_id = $1
       order by o.created_at desc, o.id desc
       limit ${MAX_EXPORT_ROWS + 1}`,
    );
    return this.file(
      "orders",
      [
        "order_number",
        "created_at",
        "status",
        "channel",
        "currency",
        "total_minor",
        "customer_name",
        "customer_phone",
        "governorate",
        "payment_method",
        "items_count",
      ],
      rows,
    );
  }

  async exportProducts(tenantId: string): Promise<ExportFile> {
    const rows = await this.run(
      tenantId,
      "products",
      `
      select v.sku, p.name_en, p.name_ar, p.kind, p.status, p.category, p.brand,
             array_to_string(array(select jsonb_array_elements_text(p.tags)), ';') as tags,
             p.is_hazardous, v.barcode, v.price_minor, v.currency, v.weight_grams
        from variants v
        join products p on p.id = v.product_id
       where v.tenant_id = $1
       order by v.sku asc
       limit ${MAX_EXPORT_ROWS + 1}`,
    );
    return this.file(
      "products",
      [
        "sku",
        "name_en",
        "name_ar",
        "kind",
        "status",
        "category",
        "brand",
        "tags",
        "hazardous",
        "barcode",
        "price_minor",
        "currency",
        "weight_grams",
      ],
      rows,
    );
  }

  async exportInventory(tenantId: string): Promise<ExportFile> {
    const rows = await this.run(
      tenantId,
      "inventory",
      `
      select v.sku, l.code as location_code, l.name as location_name, b.bucket, b.quantity
        from stock_balances b
        join variants v on v.id = b.variant_id
        join locations l on l.id = b.location_id
       where b.tenant_id = $1
       order by v.sku asc, l.name asc, b.bucket asc
       limit ${MAX_EXPORT_ROWS + 1}`,
    );
    return this.file(
      "inventory",
      ["sku", "location_code", "location_name", "bucket", "quantity"],
      rows,
    );
  }

  async exportCustomers(tenantId: string): Promise<ExportFile> {
    const rows = await this.run(
      tenantId,
      "customers",
      `
      select c.full_name, c.phone, c.email, c.created_at,
             (select count(*)::int from orders o where o.customer_id = c.id) as order_count
        from customers c
       where c.tenant_id = $1
       order by c.created_at desc, c.id desc
       limit ${MAX_EXPORT_ROWS + 1}`,
    );
    return this.file(
      "customers",
      ["full_name", "phone", "email", "created_at", "order_count"],
      rows,
    );
  }

  private async run(
    tenantId: string,
    resource: ExportResource,
    sql: string,
  ): Promise<Row[]> {
    const rows = await withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query(sql, [tenantId]);
      return result.rows as Row[];
    });
    if (rows.length > MAX_EXPORT_ROWS) {
      throw new ExportTooLargeError(resource);
    }
    return rows;
  }

  private file(
    resource: ExportResource,
    header: string[],
    rows: Row[],
  ): ExportFile {
    const date = this.clock.now().toISOString().slice(0, 10);
    return {
      resource,
      filename: `${resource}-${date}.csv`,
      csv: toCsv(
        header,
        rows.map((row) => header.map((column) => row[column] as never)),
      ),
      rowCount: rows.length,
    };
  }
}
