import { describe, expect, it } from "vitest";

import {
  decodeCursor,
  encodeCursor,
  MemoryRateLimitStore,
  readPagination,
  redactAddress,
  redactPhone,
  SafetyGuard,
} from "../src/platform/service";

describe("Cursor pagination (P4-S13-T03)", () => {
  it("round-trips a cursor", () => {
    const cursor = { createdAt: "2026-02-01T10:00:00.000Z", id: "abc" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("rejects an invalid cursor with a 400", () => {
    expect(() => readPagination({ cursor: "not-a-cursor" })).toThrow(
      /cursor is not valid/,
    );
  });

  it("caps the limit", () => {
    expect(readPagination({ limit: "5000" }).limit).toBe(100);
    expect(readPagination({ limit: "10" }).limit).toBe(10);
    expect(readPagination({}).limit).toBe(25);
  });
});

describe("Rate limiting (P4-S13-T02)", () => {
  it("counts per key within the window", async () => {
    const store = new MemoryRateLimitStore();
    const first = await store.increment("k", 60);
    expect(first.count).toBe(1);
    const second = await store.increment("k", 60);
    expect(second.count).toBe(2);
    const other = await store.increment("other", 60);
    expect(other.count).toBe(1);
  });

  it("resets after the window", async () => {
    const store = new MemoryRateLimitStore();
    await store.increment("k", 0);
    const after = await store.increment("k", 60);
    expect(after.count).toBe(1);
  });
});

describe("PII redaction (P4-S14-T04)", () => {
  it("masks all but the last four digits of a phone", () => {
    expect(redactPhone("+201012345678")).toBe("********5678");
  });

  it("masks the street but keeps the city", () => {
    expect(
      redactAddress({ line1: "12 Mahmoud Street", city: "Giza" }),
    ).toContain("Giza");
  });
});

describe("Agent safety controls (P4-S13-T04)", () => {
  it("returns pending approval above the threshold without executing", () => {
    const guard = new SafetyGuard({ approvalThresholdMinor: 1000 });
    const decision = guard.check({
      keyId: "k1",
      action: "refund",
      amountMinor: 5000,
    });
    expect(decision.outcome).toBe("pending_approval");
    expect(decision.status).toBe(202);
  });

  it("executes below the threshold", () => {
    const guard = new SafetyGuard({ approvalThresholdMinor: 1000 });
    expect(
      guard.check({ keyId: "k1", action: "refund", amountMinor: 100 }).outcome,
    ).toBe("execute");
  });

  it("honours a dry run", () => {
    const guard = new SafetyGuard();
    const decision = guard.check({
      keyId: "k1",
      action: "cancel_order",
      dryRun: true,
    });
    expect(decision.outcome).toBe("dry_run");
    expect(decision.body.dryRun).toBe(true);
  });

  it("blocks a key the kill switch has disabled", () => {
    const guard = new SafetyGuard({ disabledKeys: new Set(["k1"]) });
    const decision = guard.check({ keyId: "k1", action: "refund" });
    expect(decision.outcome).toBe("blocked");
    expect(decision.status).toBe(403);
  });

  it("blocks a key that exceeded its hourly volume cap", () => {
    const guard = new SafetyGuard({ volumeCapPerHour: 2 });
    guard.check({ keyId: "k1", action: "a" });
    guard.check({ keyId: "k1", action: "b" });
    const third = guard.check({ keyId: "k1", action: "c" });
    expect(third.outcome).toBe("blocked");
    expect(third.status).toBe(429);
  });
});
