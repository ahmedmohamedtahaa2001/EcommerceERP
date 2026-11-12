import type { Pool } from "pg";

import type { CompanyPatch } from "./validation";

export interface CompanyProfile {
  name: string;
  slug: string;
  timezone: string;
  defaultCurrency: string;
  countryCode: string;
  allowNegativeStock: boolean;
}

interface ProfileRow {
  name: string;
  slug: string;
  timezone: string;
  default_currency: string;
  country_code: string;
  allow_negative_stock: boolean;
}

const COLUMNS: Record<keyof CompanyPatch, string> = {
  name: "name",
  timezone: "timezone",
  defaultCurrency: "default_currency",
  countryCode: "country_code",
  allowNegativeStock: "allow_negative_stock",
};

function toProfile(row: ProfileRow): CompanyProfile {
  return {
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    defaultCurrency: row.default_currency,
    countryCode: row.country_code,
    allowNegativeStock: row.allow_negative_stock,
  };
}

/** The business profile lives on the tenant row, which has no tenant_id of its own. */
export class CompanyService {
  constructor(private readonly pool: Pool) {}

  async get(tenantId: string): Promise<CompanyProfile | null> {
    const result = await this.pool.query<ProfileRow>(
      `select name, slug, timezone, default_currency, country_code, allow_negative_stock
         from tenants where id = $1`,
      [tenantId],
    );
    const row = result.rows[0];
    return row ? toProfile(row) : null;
  }

  async update(
    tenantId: string,
    patch: CompanyPatch,
  ): Promise<CompanyProfile | null> {
    const assignments: string[] = [];
    const values: unknown[] = [tenantId];
    for (const [field, value] of Object.entries(patch) as [
      keyof CompanyPatch,
      unknown,
    ][]) {
      values.push(value);
      assignments.push(`${COLUMNS[field]} = $${values.length}`);
    }
    const result = await this.pool.query<ProfileRow>(
      `update tenants set ${assignments.join(", ")} where id = $1
       returning name, slug, timezone, default_currency, country_code, allow_negative_stock`,
      values,
    );
    const row = result.rows[0];
    return row ? toProfile(row) : null;
  }
}
