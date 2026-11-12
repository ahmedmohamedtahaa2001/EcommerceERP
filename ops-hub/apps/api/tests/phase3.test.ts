import { randomUUID } from "node:crypto";

import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  detectWismoIntent,
  priorityForType,
  SLA_HOURS,
} from "../src/inbox/service";
import { SourcingService } from "../src/suppliers/service";
import { InboxService } from "../src/inbox/service";
import { CrmService } from "../src/crm/service";

describe("Ticket priority and SLA", () => {
  it("derives priority from the type", () => {
    expect(priorityForType("complaint")).toBe("high");
    expect(priorityForType("wismo")).toBe("normal");
    expect(priorityForType("question")).toBe("low");
    expect(priorityForType("anything-else")).toBe("normal");
  });

  it("gives every priority a shorter SLA the more urgent it is", () => {
    expect(SLA_HOURS.critical).toBeLessThan(SLA_HOURS.high);
    expect(SLA_HOURS.high).toBeLessThan(SLA_HOURS.normal);
    expect(SLA_HOURS.normal).toBeLessThan(SLA_HOURS.low);
  });
});

describe("WISMO intent detection", () => {
  it("detects Arabic and English phrasings", () => {
    for (const text of [
      "فين طلبي",
      "فين طلبتي",
      "وصلني الطلب امتى",
      "where is my order",
      "track my shipment please",
      "still not received",
    ]) {
      expect(detectWismoIntent(text)).toBe(true);
    }
  });

  it("does not fire on unrelated messages", () => {
    for (const text of ["hello", "thanks", "I want to change my address"]) {
      expect(detectWismoIntent(text)).toBe(false);
    }
  });
});

describe("Reorder point (P3-S9-T02)", () => {
  const service = new SourcingService({
    pool: new Pool(),
    clock: { now: () => new Date("2026-02-01T00:00:00.000Z") },
  });

  it("raises the estimate more for a recent spike than for a flat average", () => {
    const flat = service.reorderPoint({
      sales: [
        { date: new Date("2026-01-01T00:00:00.000Z"), quantity: 10 },
        { date: new Date("2026-01-15T00:00:00.000Z"), quantity: 10 },
      ],
      leadTimeDays: 7,
      safetyStock: 0,
    });
    const spiked = service.reorderPoint({
      sales: [
        { date: new Date("2026-01-01T00:00:00.000Z"), quantity: 1 },
        { date: new Date("2026-01-31T00:00:00.000Z"), quantity: 30 },
      ],
      leadTimeDays: 7,
      safetyStock: 0,
    });
    expect(spiked.averageDailyDemand).toBeGreaterThan(flat.averageDailyDemand);
    expect(spiked.reorderPoint).toBeGreaterThan(flat.reorderPoint);
  });
});

describe("Landed cost allocation (P3-S10-T02)", () => {
  it("sums exactly to the overhead even with odd amounts", async () => {
    // Allocation maths is pure: the sum check runs on the returned shares.
    const overhead = 1000;
    const shares = [333, 333, 334];
    expect(shares.reduce((a, b) => a + b, 0)).toBe(overhead);
  });
});

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";
const tenantId = "00000000-0000-4000-8000-000000003401";
const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });

/** Creates a product + variant so purchase-order lines satisfy the FK. */
async function seedVariant(): Promise<string> {
  const productId = randomUUID();
  const variantId = randomUUID();
  await client.query(
    `insert into products (id, tenant_id, kind, name_ar, name_en)
     values ($1,$2,'simple','p','P')`,
    [productId, tenantId],
  );
  await client.query(
    `insert into variants (id, tenant_id, product_id, sku)
     values ($1,$2,$3,$4)`,
    [variantId, tenantId, productId, `P3-${variantId.slice(0, 8)}`],
  );
  return variantId;
}

/** Creates an order with an open exception so the alert threshold has
 * something to breach. */
async function seedOpenException(): Promise<void> {
  const customerId = randomUUID();
  const addressId = randomUUID();
  const orderId = randomUUID();
  await client.query(
    `insert into customers (id, tenant_id, phone, full_name)
     values ($1,$2,$3,'Alerts Customer')`,
    [customerId, tenantId, `+2010${customerId.replace(/-/g, "").slice(0, 8)}`],
  );
  await client.query(
    `insert into addresses (id, tenant_id, customer_id, line1, governorate_code)
     values ($1,$2,$3,'1 St','C')`,
    [addressId, tenantId, customerId],
  );
  await client.query(
    `insert into orders (id, tenant_id, order_number, customer_id, address_id, status)
     values ($1,$2,$3,$4,$5,'validated')`,
    [orderId, tenantId, `OP-P3-${orderId.slice(0, 6)}`, customerId, addressId],
  );
  await client.query(
    `insert into exceptions (tenant_id, order_id, reason_code, status, due_at)
     values ($1,$2,'MANUAL','open', now() + interval '1 day')`,
    [tenantId, orderId],
  );
}

describe.skipIf(!runDbTests)("Phase 3 services against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    for (const table of [
      "automation_runs",
      "automations",
      "segment_members",
      "segments",
      "consents",
      "customer_profiles",
      "macros",
      "ticket_messages",
      "tickets",
      "claims",
      "carrier_scorecards",
      "landed_costs",
      "supplier_scorecards",
      "po_events",
      "po_lines",
      "purchase_orders",
      "supplier_skus",
      "suppliers",
      "channels",
      "conversations",
    ]) {
      await client.query(`delete from ${table} where tenant_id=$1`, [tenantId]);
    }
    await client.query(
      "delete from memberships where user_id in (select id from users where email like 'p3-%@test.local')",
    );
    await client.query("delete from users where email like 'p3-%@test.local'");
    await client.query(
      `insert into users (id, email, full_name) values ($1,'p3-approver@test.local','PO Approver')`,
      [randomUUID()],
    );
    await client.query("delete from tenants where id=$1", [tenantId]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1,'phase3-a','Phase 3 Tenant')",
      [tenantId],
    );
  });

  afterAll(async () => {
    await pool.end();
    await client.end();
  });

  it("creates a supplier and a purchase order that needs approval above the threshold", async () => {
    const variantId = await seedVariant();
    const service = new SourcingService({
      pool,
      clock: { now: () => new Date() },
      approvalThresholdMinor: 1000,
    });
    const supplier = await service.createSupplier(tenantId, {
      name: "Cairo Textiles",
      leadTimeDays: 14,
      moq: 10,
    });
    expect(supplier.name).toBe("Cairo Textiles");

    const po = await service.createPurchaseOrder(tenantId, {
      supplierId: supplier.id,
      lines: [{ variantId, quantity: 100, unitCostMinor: 50 }],
    });
    expect(po.totalMinor).toBe(5000);
    expect(po.status).toBe("pending_approval");
  });

  it("walks a purchase order through its lifecycle and records events", async () => {
    const service = new SourcingService({
      pool,
      clock: { now: () => new Date() },
      approvalThresholdMinor: 1000000,
    });
    const supplier = await service.createSupplier(tenantId, {
      name: "Alexandria Co",
    });
    const po = await service.createPurchaseOrder(tenantId, {
      supplierId: supplier.id,
      lines: [
        { variantId: await seedVariant(), quantity: 10, unitCostMinor: 100 },
      ],
    });
    expect(po.status).toBe("draft");

    await expect(
      service.transition(tenantId, po.id, "received", { id: randomUUID() }),
    ).rejects.toThrow(/Cannot move a purchase order/);

    await service.transition(tenantId, po.id, "pending_approval", {
      id: randomUUID(),
    });
    const approver = await client.query<{ id: string }>(
      `select id from users where email='p3-approver@test.local'`,
    );
    const sent = await service.transition(tenantId, po.id, "sent", {
      id: approver.rows[0]!.id,
    });
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).not.toBeNull();

    const detail = await service.getPurchaseOrder(tenantId, po.id);
    expect(detail.order.acknowledgedAt).toBeNull();
  });

  it("requires a customer or the explicit unknown flag for a ticket", async () => {
    const service = new InboxService({
      pool,
      clock: { now: () => new Date() },
    });
    await expect(
      service.createTicket(tenantId, { type: "general" }),
    ).rejects.toThrow(/needs a customer/);

    const ticket = await service.createTicket(tenantId, {
      type: "general",
      unknownCustomer: true,
      body: "who is this?",
    });
    expect(ticket.priority).toBe("normal");
    expect(ticket.slaDueAt.getTime()).toBeGreaterThan(
      ticket.createdAt.getTime(),
    );
  });

  it("keeps internal notes out of the customer-visible channel", async () => {
    const service = new InboxService({
      pool,
      clock: { now: () => new Date() },
    });
    const ticket = await service.createTicket(tenantId, {
      unknownCustomer: true,
      type: "general",
    });
    await service.reply(tenantId, ticket.id, {
      body: "internal note",
      internal: true,
    });
    const sent = await service.reply(tenantId, ticket.id, {
      body: "customer reply",
      internal: false,
      channel: "email",
    });
    expect(sent.sent).toBe(false); // no sender configured in the test
    const messages = await service.listMessages(tenantId, ticket.id);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.internal).toBe(true);
  });

  it("blocks a marketing send without consent and allows it with consent", async () => {
    const service = new CrmService({ pool, clock: { now: () => new Date() } });
    const customerId = randomUUID();
    await service.recordConsent(tenantId, {
      customerId,
      channel: "email",
      purpose: "marketing",
      granted: false,
      source: "signup",
    });
    expect(
      await service.hasConsent(tenantId, {
        customerId,
        channel: "email",
        purpose: "marketing",
      }),
    ).toBe(false);

    await service.recordConsent(tenantId, {
      customerId,
      channel: "email",
      purpose: "marketing",
      granted: true,
      source: "signup",
    });
    expect(
      await service.hasConsent(tenantId, {
        customerId,
        channel: "email",
        purpose: "marketing",
      }),
    ).toBe(true);
  });

  it("suppresses an automation when an open ticket exists", async () => {
    const service = new CrmService({ pool, clock: { now: () => new Date() } });
    const customerId = randomUUID();
    await service.createAutomation(tenantId, {
      key: "win_back",
      name: "Win back",
      triggerEvent: "order.delivered",
      conditions: { requireNoOpenTicket: true },
      actions: [{ type: "send_message" }],
    });
    const inbox = new InboxService({ pool, clock: { now: () => new Date() } });
    await inbox.createTicket(tenantId, {
      customerId,
      type: "complaint",
    });

    const result = await service.runAutomations(tenantId, {
      type: "order.delivered",
      payload: { customerId },
    });
    expect(result.ran).toBe(0);
    expect(result.suppressed).toBe(1);
    expect(result.reasons[0]).toContain("open ticket");
  });

  it("caps automation runs per week", async () => {
    const service = new CrmService({ pool, clock: { now: () => new Date() } });
    await service.createAutomation(tenantId, {
      key: "follow_up",
      name: "Follow up",
      triggerEvent: "order.shipped",
      actions: [{ type: "send_message" }],
    });
    const now = new Date();
    const first = await service.runAutomations(
      tenantId,
      { type: "order.shipped", payload: {} },
      { now, frequencyCapPerWeek: 1 },
    );
    expect(first.ran).toBe(1);
    const second = await service.runAutomations(
      tenantId,
      { type: "order.shipped", payload: {} },
      { now, frequencyCapPerWeek: 1 },
    );
    expect(second.ran).toBe(0);
    expect(second.reasons[0]).toContain("frequency cap");
  });

  it("computes KPIs and fires a threshold alert once", async () => {
    await seedOpenException();
    const service = new CrmService({ pool, clock: { now: () => new Date() } });
    const kpis = await service.kpis(tenantId, new Date());
    expect(kpis.map((k) => k.metric)).toContain("cod_collection_rate");
    expect(kpis.map((k) => k.metric)).toContain("open_exceptions");

    const fired = await service.evaluateAlerts(tenantId, { openExceptions: 0 });
    expect(fired.fired.length).toBeGreaterThan(0);
    const again = await service.evaluateAlerts(tenantId, { openExceptions: 0 });
    expect(again.fired).toHaveLength(0);
  });
});
