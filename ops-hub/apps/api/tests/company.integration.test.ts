import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgTenantPolicyReader } from "../src/availability/pg-tenant-policy";
import { CompanyService } from "../src/company/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantId = "00000000-0000-4000-8000-00000000f201";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const company = new CompanyService(pool);

describe.skipIf(!runDbTests)("Business profile against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from tenants where id = $1", [tenantId]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'company-test', 'Old Name')",
      [tenantId],
    );
  });

  afterAll(async () => {
    await client.query("delete from tenants where id = $1", [tenantId]);
    await client.end();
    await pool.end();
  });

  it("starts with Egyptian defaults", async () => {
    const profile = await company.get(tenantId);
    expect(profile).toMatchObject({
      name: "Old Name",
      timezone: "Africa/Cairo",
      defaultCurrency: "EGP",
      countryCode: "EG",
      allowNegativeStock: false,
    });
  });

  it("persists a change and returns the updated profile", async () => {
    const updated = await company.update(tenantId, {
      name: "Nile Goods",
      timezone: "Asia/Riyadh",
      defaultCurrency: "SAR",
      countryCode: "SA",
    });
    expect(updated).toMatchObject({
      name: "Nile Goods",
      timezone: "Asia/Riyadh",
      defaultCurrency: "SAR",
      countryCode: "SA",
    });
    expect(await company.get(tenantId)).toEqual(updated);
  });

  it("drives the negative-stock rule that the stock ledger reads", async () => {
    const policy = new PgTenantPolicyReader(pool);
    expect(await policy.allowsNegativeStock(tenantId)).toBe(false);
    await company.update(tenantId, { allowNegativeStock: true });
    expect(await policy.allowsNegativeStock(tenantId)).toBe(true);
    await company.update(tenantId, { allowNegativeStock: false });
  });
});
