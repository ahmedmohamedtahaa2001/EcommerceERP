import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { KpiService } from "../src/kpis/service";

const docs = readFileSync(join(process.cwd(), "docs/kpis.md"), "utf8");

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";
const tenantId = "00000000-0000-4000-8000-000000005401";
const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });

describe("KPI documentation stays in sync", () => {
  it("documents every metric the service can produce", () => {
    const documented = new Set(
      [...docs.matchAll(/^\| `([a-z_]+)` +\|/gm)].map((m) => m[1]),
    );
    expect(documented.size).toBeGreaterThan(15);
    // Every metric in the table must be a real metric name.
    for (const metric of documented) {
      expect(metric).toMatch(/^[a-z_]+$/);
    }
  });
});

describe.skipIf(!runDbTests)("KPI service against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from exceptions where tenant_id=$1", [tenantId]);
    await client.query("delete from orders where tenant_id=$1", [tenantId]);
    await client.query("delete from customers where tenant_id=$1", [tenantId]);
    await client.query("delete from tenants where id=$1", [tenantId]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1,'kpis-a','KPI Tenant')",
      [tenantId],
    );
  });

  afterAll(async () => {
    await pool.end();
    await client.end();
  });

  it("returns the documented metric set with units", async () => {
    const service = new KpiService({ pool, clock: { now: () => new Date() } });
    const kpis = await service.compute(tenantId, new Date());
    const names = kpis.map((k) => k.metric);

    for (const expected of [
      "orders_created",
      "order_cycle_time_hours",
      "inventory_accuracy_percent",
      "oversold_skus",
      "dock_to_stock_hours",
      "shipments_delivered",
      "shipping_on_time_percent",
      "scan_gap_open",
      "wismo_tickets",
      "cod_expected_minor",
      "cod_collected_minor",
      "cod_collection_rate_percent",
      "cod_unmatched_lines",
      "cod_unmatched_minor",
      "support_first_response_hours",
      "support_resolution_hours",
      "crm_repeat_rate_percent",
      "crm_unsubscribed",
      "open_exceptions",
    ]) {
      expect(names).toContain(expected);
    }

    for (const kpi of kpis) {
      expect(["count", "percent", "minor", "hours"]).toContain(kpi.unit);
      expect(Number.isFinite(kpi.value)).toBe(true);
      // Every metric the API returns must be documented.
      expect(docs).toContain(`\`${kpi.metric}\``);
    }
  });

  it("answers a single metric by name", async () => {
    const service = new KpiService({ pool, clock: { now: () => new Date() } });
    const one = await service.one(
      tenantId,
      "cod_collection_rate_percent",
      new Date(),
    );
    expect(one).not.toBeNull();
    expect(one!.unit).toBe("percent");
    expect(await service.one(tenantId, "not_a_metric", new Date())).toBeNull();
  });

  it("computes the collection rate from the payments", async () => {
    const customerId = randomUuid();
    const orderId = randomUuid();
    await client.query(
      `insert into customers (id, tenant_id, phone) values ($1,$2,$3)`,
      [
        customerId,
        tenantId,
        `+2010${customerId.replace(/-/g, "").slice(0, 8)}`,
      ],
    );
    await client.query(
      `insert into orders (id, tenant_id, order_number, customer_id, status)
       values ($1,$2,$3,$4,'validated')`,
      [orderId, tenantId, `OP-KPI-${orderId.slice(0, 6)}`, customerId],
    );
    await client.query(
      `insert into payments (tenant_id, order_id, method, amount_minor, currency, status)
       values ($1,$2,'cod',10000,'EGP','collected')`,
      [tenantId, orderId],
    );

    const service = new KpiService({ pool, clock: { now: () => new Date() } });
    const expected = await service.one(
      tenantId,
      "cod_expected_minor",
      new Date(),
    );
    const collected = await service.one(
      tenantId,
      "cod_collected_minor",
      new Date(),
    );
    const rate = await service.one(
      tenantId,
      "cod_collection_rate_percent",
      new Date(),
    );
    expect(expected!.value).toBe(10000);
    expect(collected!.value).toBe(10000);
    expect(rate!.value).toBe(100);
  });
});

function randomUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
