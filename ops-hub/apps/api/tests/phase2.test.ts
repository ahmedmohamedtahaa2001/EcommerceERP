import { randomUUID } from "node:crypto";

import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseConfirmationReply, scoreRisk } from "../src/risk/service";
import { classifyAbc } from "../src/receiving/service";
import { CircuitBreaker } from "../src/dlq/service";
import { csvSettlementParser } from "../src/settlements/service";
import { route } from "../src/routing/service";

describe("Confirmation reply parsing", () => {
  it("accepts Arabic and English yes/no, case-insensitively", () => {
    for (const yes of ["yes", "YES", "Y", "ايوه", "أيوه", "نعم"]) {
      expect(parseConfirmationReply(yes)).toBe("confirmed");
    }
    for (const no of ["no", "NO", "لا", "مش", "مفيش"]) {
      expect(parseConfirmationReply(no)).toBe("cancelled");
    }
  });

  it("returns null for anything else", () => {
    expect(parseConfirmationReply("maybe")).toBeNull();
    expect(parseConfirmationReply("")).toBeNull();
  });
});

describe("Risk scoring (P2-S7-T02)", () => {
  const base = {
    priorRefusals: 0,
    priorRtos: 0,
    governorateRtoRate: 0,
    orderValueMinor: 10000,
    averageOrderValueMinor: 10000,
    addressQuality: "complete" as const,
    confirmationOutcome: null,
  };

  it("is deterministic", () => {
    const input = { ...base, priorRefusals: 2 };
    expect(scoreRisk(input)).toEqual(scoreRisk(input));
  });

  it("scores a clean order as low", () => {
    expect(scoreRisk(base).tier).toBe("low");
    expect(scoreRisk(base).reasons).toEqual([]);
  });

  it("scores refusals, RTOs and a cancelled confirmation as high", () => {
    const score = scoreRisk({
      ...base,
      priorRefusals: 2,
      priorRtos: 1,
      governorateRtoRate: 0.4,
      confirmationOutcome: "cancelled",
    });
    expect(score.tier).toBe("high");
    expect(score.reasons.length).toBeGreaterThanOrEqual(4);
  });

  it("scores one prior refusal as medium", () => {
    expect(scoreRisk({ ...base, priorRefusals: 1 }).tier).toBe("medium");
  });

  it("flags an incomplete address", () => {
    const score = scoreRisk({ ...base, addressQuality: "partial" });
    expect(score.tier).toBe("medium");
    expect(score.reasons[0]).toContain("partially");
  });
});

describe("ABC classification (P2-S6-T05)", () => {
  it("puts the top value item in class A", () => {
    const rows = [
      { valueMinor: 800000, unitsSold: 1 },
      { valueMinor: 100000, unitsSold: 10 },
      { valueMinor: 100000, unitsSold: 10 },
    ];
    expect(classifyAbc(rows)).toBe("A");
  });

  it("falls back to C when nothing sold", () => {
    expect(classifyAbc([{ valueMinor: 100, unitsSold: 0 }])).toBe("C");
  });
});

describe("Circuit breaker (P2-S8-T05)", () => {
  it("opens after N failures and cools down", () => {
    let now = 1_000;
    const breaker = new CircuitBreaker(
      { failureThreshold: 3, coolDownMs: 500 },
      { now: () => now },
    );
    expect(breaker.state("bosta")).toBe("closed");
    breaker.onFailure("bosta");
    breaker.onFailure("bosta");
    expect(breaker.state("bosta")).toBe("closed");
    breaker.onFailure("bosta");
    expect(breaker.state("bosta")).toBe("open");
    expect(breaker.canRequest("bosta")).toBe(false);

    now += 600;
    expect(breaker.state("bosta")).toBe("half_open");
    expect(breaker.canRequest("bosta")).toBe(true);
  });

  it("keeps other systems unaffected", () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      coolDownMs: 500,
    });
    breaker.onFailure("bosta");
    expect(breaker.state("posta")).toBe("closed");
    expect(breaker.canRequest("posta")).toBe(true);
  });

  it("resets after a success", () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      coolDownMs: 500,
    });
    breaker.onFailure("jt");
    breaker.onSuccess("jt");
    expect(breaker.state("jt")).toBe("closed");
  });
});

describe("Settlement CSV parser (P1-S5-T05 / P2-S8-T01)", () => {
  const parser = csvSettlementParser("bosta");

  it("parses tracking, amount and currency", () => {
    const lines = parser.parse(
      "tracking,amount,currency\nTRK-1,15000,EGP\nTRK-2,20000,EGP",
    );
    expect(lines).toHaveLength(2);
    expect(lines![0]).toMatchObject({
      trackingNumber: "TRK-1",
      amountMinor: 15000,
      currency: "EGP",
    });
  });

  it("returns null for a file it does not understand", () => {
    expect(parser.parse("a,b\n1,2")).toBeNull();
  });
});

describe("Routing (P2-S8-T08)", () => {
  it("prefers a carrier that covers the governorate over a faster one", () => {
    const decision = route({
      governorateCode: "GZ",
      requiredQuantity: 5,
      locations: [
        {
          locationId: "l1",
          availableToPromise: 1,
          coverage: ["GZ"],
          costMinor: 10,
        },
        {
          locationId: "l2",
          availableToPromise: 20,
          coverage: ["GZ"],
          costMinor: 50,
        },
        {
          locationId: "l3",
          availableToPromise: 20,
          coverage: ["C"],
          costMinor: 1,
        },
      ],
      carriers: [
        {
          carrier: "posta",
          coverage: ["C"],
          supportsCod: true,
          onTimeRate: 0.9,
          costMinor: 10,
        },
        {
          carrier: "bosta",
          coverage: ["GZ"],
          supportsCod: true,
          onTimeRate: 0.8,
          costMinor: 20,
        },
      ],
    });
    expect(decision).not.toBeNull();
    expect(decision!.locationId).toBe("l2");
    expect(decision!.carrier).toBe("bosta");
  });

  it("returns null when no location has enough stock", () => {
    const decision = route({
      governorateCode: "GZ",
      requiredQuantity: 100,
      locations: [
        { locationId: "l1", availableToPromise: 1, coverage: [], costMinor: 0 },
      ],
      carriers: [],
    });
    expect(decision).toBeNull();
  });

  it("prefers the carrier with the higher on-time rate", () => {
    const decision = route({
      governorateCode: "GZ",
      requiredQuantity: 1,
      locations: [
        {
          locationId: "l1",
          availableToPromise: 10,
          coverage: ["GZ"],
          costMinor: 0,
        },
      ],
      carriers: [
        {
          carrier: "slow",
          coverage: ["GZ"],
          supportsCod: true,
          onTimeRate: 0.5,
          costMinor: 1,
        },
        {
          carrier: "fast",
          coverage: ["GZ"],
          supportsCod: true,
          onTimeRate: 0.95,
          costMinor: 50,
        },
      ],
    });
    expect(decision!.carrier).toBe("fast");
  });
});

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";
const tenantId = "00000000-0000-4000-8000-000000002401";
const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });

describe.skipIf(!runDbTests)("Phase 2 services against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from dlq_entries where tenant_id=$1", [
      tenantId,
    ]);
    await client.query("delete from settlement_lines where tenant_id=$1", [
      tenantId,
    ]);
    await client.query("delete from settlement_files where tenant_id=$1", [
      tenantId,
    ]);
    await client.query("delete from risk_scores where tenant_id=$1", [
      tenantId,
    ]);
    await client.query("delete from cod_attempts where tenant_id=$1", [
      tenantId,
    ]);
    await client.query("delete from cod_tasks where tenant_id=$1", [tenantId]);
    await client.query("delete from return_lines where tenant_id=$1", [
      tenantId,
    ]);
    await client.query("delete from refunds where tenant_id=$1", [tenantId]);
    await client.query("delete from returns where tenant_id=$1", [tenantId]);
    await client.query("delete from cycle_counts where tenant_id=$1", [
      tenantId,
    ]);
    await client.query("delete from receipt_lines where tenant_id=$1", [
      tenantId,
    ]);
    await client.query("delete from receipts where tenant_id=$1", [tenantId]);
    await client.query("delete from bin_stock where tenant_id=$1", [tenantId]);
    await client.query("delete from tenants where id=$1", [tenantId]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1,'phase2-a','Phase 2 Tenant')",
      [tenantId],
    );
  });

  afterAll(async () => {
    await pool.end();
    await client.end();
  });

  it("stores a COD task and counts unanswered attempts", async () => {
    const { CodService } = await import("../src/risk/service");
    const service = new CodService({ pool, clock: { now: () => new Date() } });
    const task = await service.createTask(tenantId, { orderId: randomUUID() });
    expect(task.status).toBe("pending");

    let last = await service.recordAttempt(tenantId, task.id, {
      channel: "whatsapp",
      outcome: "no_answer",
    });
    expect(last.attempts).toBe(1);
    expect(last.status).toBe("pending");

    await service.recordAttempt(tenantId, task.id, {
      channel: "whatsapp",
      outcome: "no_answer",
    });
    last = await service.recordAttempt(tenantId, task.id, {
      channel: "whatsapp",
      outcome: "no_answer",
    });
    expect(last.attempts).toBe(3);
    expect(last.status).toBe("needs_agent");

    const confirmed = await service.recordAttempt(tenantId, task.id, {
      channel: "whatsapp",
      outcome: "confirmed",
      response: "ايوه",
    });
    expect(confirmed.status).toBe("resolved");
    expect(confirmed.outcome).toBe("confirmed");
  });

  it("imports a settlement file once", async () => {
    const { SettlementService } = await import("../src/settlements/service");
    const service = new SettlementService({
      pool,
      clock: { now: () => new Date() },
      parsers: [csvSettlementParser("bosta")],
    });
    const content = "tracking,amount,currency\nTRK-1,15000,EGP";
    const first = await service.importFile(tenantId, {
      content,
      carrier: "bosta",
    });
    expect(first.imported).toBe(1);
    expect(first.duplicate).toBe(false);

    const second = await service.importFile(tenantId, {
      content,
      carrier: "bosta",
    });
    expect(second.duplicate).toBe(true);
    expect(second.imported).toBe(0);
  });

  it("replays a dead-lettered message exactly once", async () => {
    const { DlqService } = await import("../src/dlq/service");
    const service = new DlqService({
      pool,
      clock: { now: () => new Date() },
      handler: async () => true,
    });
    const entry = await service.push(tenantId, {
      source: "outbox",
      payload: { id: "x" },
      error: "boom",
    });
    const first = await service.replay(tenantId, entry.id);
    expect(first.ok).toBe(true);
    expect(first.status).toBe("replayed");

    const second = await service.replay(tenantId, entry.id);
    expect(second.ok).toBe(false);
    expect(second.status).toBe("replayed");
  });
});
