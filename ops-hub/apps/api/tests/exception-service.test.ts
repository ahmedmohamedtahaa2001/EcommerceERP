import { describe, expect, it } from "vitest";

import {
  ExceptionAlreadyResolvedError,
  ExceptionNotFoundError,
} from "../src/orders/duplicate-errors";
import { ExceptionService } from "../src/orders/exception-service";
import type { ExceptionRecord, ExceptionStore } from "../src/orders/types";

const TENANT = "tenant-1";

class FakeClock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  advanceHours(hours: number): void {
    this.current = new Date(this.current.getTime() + hours * 60 * 60 * 1000);
  }
}

class FakeExceptionStore implements ExceptionStore {
  records = new Map<string, ExceptionRecord>();
  private seq = 0;

  async create(
    tenantId: string,
    orderId: string,
    reasonCode: string,
    dueAt: Date,
  ): Promise<ExceptionRecord> {
    this.seq += 1;
    const record: ExceptionRecord = {
      id: "exc-" + this.seq,
      tenantId,
      orderId,
      reasonCode,
      status: "open",
      metadata: null,
      ownerId: null,
      dueAt,
      resolution: null,
      overdueNotifiedAt: null,
      createdAt: dueAt,
    };
    this.records.set(record.id, record);
    return record;
  }

  async getById(tenantId: string, id: string): Promise<ExceptionRecord | null> {
    const record = this.records.get(id);
    return record && record.tenantId === tenantId ? record : null;
  }

  async list(tenantId: string): Promise<ExceptionRecord[]> {
    return [...this.records.values()].filter((r) => r.tenantId === tenantId);
  }

  async assign(
    tenantId: string,
    id: string,
    ownerId: string,
  ): Promise<ExceptionRecord | null> {
    const record = this.records.get(id);
    if (!record || record.tenantId !== tenantId) return null;
    record.ownerId = ownerId;
    return record;
  }

  async resolve(
    tenantId: string,
    id: string,
    resolution: string,
  ): Promise<boolean> {
    const record = this.records.get(id);
    if (!record || record.tenantId !== tenantId || record.status !== "open")
      return false;
    record.status = "resolved";
    record.resolution = resolution;
    return true;
  }

  async claimOverdue(tenantId: string, asOf: Date): Promise<ExceptionRecord[]> {
    const claimed: ExceptionRecord[] = [];
    for (const record of this.records.values()) {
      if (
        record.tenantId === tenantId &&
        record.status === "open" &&
        record.dueAt <= asOf &&
        record.overdueNotifiedAt === null
      ) {
        record.overdueNotifiedAt = asOf;
        claimed.push(record);
      }
    }
    return claimed;
  }
}

describe("ExceptionService.sweepOverdue", () => {
  it("does not claim an exception before its due date", async () => {
    const clock = new FakeClock(new Date("2026-01-01T00:00:00Z"));
    const store = new FakeExceptionStore();
    const service = new ExceptionService({ store, clock });

    await store.create(
      TENANT,
      "order-1",
      "ADDRESS_INCOMPLETE",
      new Date("2026-01-02T00:00:00Z"),
    );

    const result = await service.sweepOverdue(TENANT);
    expect(result.overdueCount).toBe(0);
  });

  it("claims an exception once its due date has passed", async () => {
    const clock = new FakeClock(new Date("2026-01-01T00:00:00Z"));
    const store = new FakeExceptionStore();
    const service = new ExceptionService({ store, clock });

    await store.create(
      TENANT,
      "order-1",
      "ADDRESS_INCOMPLETE",
      new Date("2026-01-02T00:00:00Z"),
    );

    clock.advanceHours(25); // past the due date now
    const result = await service.sweepOverdue(TENANT);
    expect(result.overdueCount).toBe(1);
  });

  it("never claims the same exception twice across repeated sweeps", async () => {
    const clock = new FakeClock(new Date("2026-01-01T00:00:00Z"));
    const store = new FakeExceptionStore();
    const service = new ExceptionService({ store, clock });

    await store.create(
      TENANT,
      "order-1",
      "ADDRESS_INCOMPLETE",
      new Date("2026-01-02T00:00:00Z"),
    );
    clock.advanceHours(25);

    const first = await service.sweepOverdue(TENANT);
    const second = await service.sweepOverdue(TENANT);

    expect(first.overdueCount).toBe(1);
    expect(second.overdueCount).toBe(0);
  });

  it("does not claim an already-resolved exception even if it's past due", async () => {
    const clock = new FakeClock(new Date("2026-01-01T00:00:00Z"));
    const store = new FakeExceptionStore();
    const service = new ExceptionService({ store, clock });

    const created = await store.create(
      TENANT,
      "order-1",
      "ADDRESS_INCOMPLETE",
      new Date("2026-01-02T00:00:00Z"),
    );
    await store.resolve(TENANT, created.id, "fixed address manually");

    clock.advanceHours(25);
    const result = await service.sweepOverdue(TENANT);
    expect(result.overdueCount).toBe(0);
  });
});

describe("ExceptionService.assign / resolve", () => {
  it("assigns an owner", async () => {
    const store = new FakeExceptionStore();
    const service = new ExceptionService({
      store,
      clock: new FakeClock(new Date()),
    });
    const created = await store.create(
      TENANT,
      "order-1",
      "ADDRESS_INCOMPLETE",
      new Date(),
    );

    const assigned = await service.assign(TENANT, created.id, "user-1");
    expect(assigned.ownerId).toBe("user-1");
  });

  it("rejects assigning an unknown exception", async () => {
    const store = new FakeExceptionStore();
    const service = new ExceptionService({
      store,
      clock: new FakeClock(new Date()),
    });
    await expect(service.assign(TENANT, "nope", "user-1")).rejects.toThrow(
      ExceptionNotFoundError,
    );
  });

  it("resolves an open exception with a resolution note", async () => {
    const store = new FakeExceptionStore();
    const service = new ExceptionService({
      store,
      clock: new FakeClock(new Date()),
    });
    const created = await store.create(
      TENANT,
      "order-1",
      "ADDRESS_INCOMPLETE",
      new Date(),
    );

    const resolved = await service.resolve(
      TENANT,
      created.id,
      "customer confirmed address by phone",
    );
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolution).toBe("customer confirmed address by phone");
  });

  it("rejects resolving an already-resolved exception", async () => {
    const store = new FakeExceptionStore();
    const service = new ExceptionService({
      store,
      clock: new FakeClock(new Date()),
    });
    const created = await store.create(
      TENANT,
      "order-1",
      "ADDRESS_INCOMPLETE",
      new Date(),
    );
    await service.resolve(TENANT, created.id, "first resolution");

    await expect(
      service.resolve(TENANT, created.id, "second resolution"),
    ).rejects.toThrow(ExceptionAlreadyResolvedError);
  });
});
