import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type {
  CustomerAddressRecord,
  CustomerRecord,
  CustomerStore,
} from "./types";

interface CustomerRow {
  id: string;
  tenant_id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AddressRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  line1: string;
  line2: string | null;
  city: string | null;
  governorate_code: string | null;
  raw_governorate: string | null;
  created_at: Date;
}

function toCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    phone: row.phone,
    fullName: row.full_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAddress(row: AddressRow): CustomerAddressRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    governorateCode: row.governorate_code,
    rawGovernorate: row.raw_governorate,
    createdAt: row.created_at,
  };
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export class PgCustomerStore implements CustomerStore {
  constructor(private readonly pool: Pool) {}

  async create(record: CustomerRecord): Promise<void> {
    await withTenant(this.pool, record.tenantId, (client) =>
      client.query(
        `insert into customers
           (id, tenant_id, phone, full_name, email, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          record.id,
          record.tenantId,
          record.phone,
          record.fullName,
          record.email,
          record.createdAt,
          record.updatedAt,
        ],
      ),
    );
  }

  async getById(tenantId: string, id: string): Promise<CustomerRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<CustomerRow>(
        `select * from customers where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toCustomer(row) : null;
    });
  }

  async update(
    tenantId: string,
    id: string,
    fields: Partial<Pick<CustomerRecord, "phone" | "fullName" | "email">>,
    updatedAt: Date,
  ): Promise<CustomerRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<CustomerRow>(
        `update customers set
           phone = coalesce($3, phone),
           full_name = case when $4 then $5 else full_name end,
           email = case when $6 then $7 else email end,
           updated_at = $8
         where tenant_id = $1 and id = $2
         returning *`,
        [
          tenantId,
          id,
          fields.phone ?? null,
          "fullName" in fields,
          fields.fullName ?? null,
          "email" in fields,
          fields.email ?? null,
          updatedAt,
        ],
      );
      const row = result.rows[0];
      return row ? toCustomer(row) : null;
    });
  }

  async list(
    tenantId: string,
    filter: {
      q?: string;
      limit: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<CustomerRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.q) {
        params.push(likePattern(filter.q));
        const p = params.length;
        conditions.push(
          `(full_name ilike $${p} or email ilike $${p} or phone ilike $${p})`,
        );
      }
      if (filter.cursor) {
        params.push(filter.cursor.createdAt, filter.cursor.id);
        conditions.push(
          `(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
        );
      }
      params.push(filter.limit);
      const result = await client.query<CustomerRow>(
        `select * from customers where ${conditions.join(" and ")}
          order by created_at desc, id desc
          limit $${params.length}`,
        params,
      );
      return result.rows.map(toCustomer);
    });
  }

  async listAddresses(
    tenantId: string,
    customerId: string,
  ): Promise<CustomerAddressRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<AddressRow>(
        `select * from addresses
          where tenant_id = $1 and customer_id = $2
          order by created_at desc, id desc`,
        [tenantId, customerId],
      );
      return result.rows.map(toAddress);
    });
  }
}
