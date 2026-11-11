import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CatalogImportService } from "../src/catalog/import-service";
import type { ImportRow } from "../src/catalog/import-parse";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

// Distinct from the other integration suites so parallel workers never
// clobber each other's fixture tenants.
const tenantA = "00000000-0000-4000-8000-000000000401";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const service = new CatalogImportService(pool);

function row(index: number, values: Record<string, string>): ImportRow {
  return { row: index, values };
}

describe.skipIf(!runDbTests)("Catalog bulk import against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from variants where tenant_id = $1", [tenantA]);
    await client.query("delete from products where tenant_id = $1", [tenantA]);
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'import-a', 'Import Tenant A')",
      [tenantA],
    );
  });

  afterAll(async () => {
    await client.query("delete from variants where tenant_id = $1", [tenantA]);
    await client.query("delete from products where tenant_id = $1", [tenantA]);
    await client.query("delete from tenants where id = $1", [tenantA]);
    await client.end();
    await pool.end();
  });

  it("dry-run reports row-level errors and writes nothing", async () => {
    const rows: ImportRow[] = [
      row(1, { sku: "IMP-001", nameEn: "Shirt", nameAr: "قميص" }),
      row(2, { sku: "", nameEn: "No SKU", nameAr: "منتج" }),
      row(3, { sku: "IMP-003", nameEn: "", nameAr: "منتج" }),
    ];

    const result = await service.import(rows, tenantA, {
      dryRun: true,
      now: new Date(),
    });

    expect(result.dryRun).toBe(true);
    expect(result.createdCount).toBe(0);
    expect(result.errors).toEqual([
      { row: 2, reason: expect.stringContaining("sku") },
      { row: 3, reason: expect.stringContaining("nameEn") },
    ]);

    const count = await client.query(
      "select count(*)::int as count from products where tenant_id = $1",
      [tenantA],
    );
    expect(count.rows[0]?.count).toBe(0);
  });

  it("imports valid rows and reports invalid ones by row number", async () => {
    const rows: ImportRow[] = [
      row(1, { sku: "IMP-100", nameEn: "Good row", nameAr: "منتج" }),
      row(2, { sku: "bad sku!", nameEn: "Bad SKU", nameAr: "منتج" }),
      row(3, { sku: "IMP-101", nameEn: "Another good row", nameAr: "منتج" }),
    ];

    const result = await service.import(rows, tenantA, {
      dryRun: false,
      now: new Date(),
    });

    expect(result.createdCount).toBe(2);
    expect(result.errors).toEqual([
      { row: 2, reason: expect.stringContaining("sku") },
    ]);

    const created = await client.query(
      "select sku from variants where tenant_id = $1 and sku in ($2, $3) order by sku",
      [tenantA, "IMP-100", "IMP-101"],
    );
    expect(created.rows.map((r) => r.sku)).toEqual(["IMP-100", "IMP-101"]);
  });

  it("rejects a sku that already exists for the tenant", async () => {
    await service.import(
      [row(1, { sku: "IMP-200", nameEn: "First", nameAr: "منتج" })],
      tenantA,
      { dryRun: false, now: new Date() },
    );

    const result = await service.import(
      [row(1, { sku: "IMP-200", nameEn: "Duplicate", nameAr: "منتج" })],
      tenantA,
      { dryRun: false, now: new Date() },
    );

    expect(result.createdCount).toBe(0);
    expect(result.errors).toEqual([
      { row: 1, reason: expect.stringContaining("already exists") },
    ]);
  });

  it("flags a sku duplicated within the same file, keeping only the first", async () => {
    const rows: ImportRow[] = [
      row(1, { sku: "IMP-300", nameEn: "First", nameAr: "منتج" }),
      row(2, { sku: "IMP-300", nameEn: "Second", nameAr: "منتج" }),
    ];

    const result = await service.import(rows, tenantA, {
      dryRun: false,
      now: new Date(),
    });

    expect(result.createdCount).toBe(1);
    expect(result.errors).toEqual([
      { row: 2, reason: expect.stringContaining("duplicate sku in file") },
    ]);
  });

  it("imports a 1,000-row fixture in under 10 seconds", async () => {
    const rows: ImportRow[] = Array.from({ length: 1000 }, (_, i) =>
      row(i + 1, {
        sku: `PERF-${String(i).padStart(5, "0")}`,
        nameEn: `Perf product ${i}`,
        nameAr: `منتج ${i}`,
      }),
    );

    const startedAt = Date.now();
    const result = await service.import(rows, tenantA, {
      dryRun: false,
      now: new Date(),
    });
    const elapsedMs = Date.now() - startedAt;

    expect(result.createdCount).toBe(1000);
    expect(result.errors).toEqual([]);
    expect(elapsedMs).toBeLessThan(10_000);

    const count = await client.query(
      "select count(*)::int as count from variants where tenant_id = $1 and sku like 'PERF-%'",
      [tenantA],
    );
    expect(count.rows[0]?.count).toBe(1000);
  });
});
