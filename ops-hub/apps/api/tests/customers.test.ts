import { describe, expect, it } from "vitest";

import {
  CustomerNotFoundError,
  CustomerValidationError,
  DuplicateCustomerEmailError,
  DuplicateCustomerPhoneError,
} from "../src/customers/errors";
import { CustomerService } from "../src/customers/service";
import type {
  CustomerAddressRecord,
  CustomerRecord,
  CustomerStore,
} from "../src/customers/types";

const tenantId = "00000000-0000-4000-8000-00000000b001";

class FakeCustomers implements CustomerStore {
  readonly rows: CustomerRecord[] = [];
  readonly addresses: CustomerAddressRecord[] = [];
  lastList: { q?: string; limit: number } | null = null;

  private uniqueViolation(constraint: string): never {
    throw Object.assign(new Error("duplicate"), { code: "23505", constraint });
  }

  async create(record: CustomerRecord): Promise<void> {
    if (
      this.rows.some(
        (r) => r.tenantId === record.tenantId && r.phone === record.phone,
      )
    ) {
      this.uniqueViolation("customers_tenant_phone_key");
    }
    if (
      record.email !== null &&
      this.rows.some(
        (r) => r.tenantId === record.tenantId && r.email === record.email,
      )
    ) {
      this.uniqueViolation("customers_tenant_email_key");
    }
    this.rows.push(record);
  }

  async getById(t: string, id: string) {
    return this.rows.find((r) => r.tenantId === t && r.id === id) ?? null;
  }

  async update(
    t: string,
    id: string,
    fields: Partial<Pick<CustomerRecord, "phone" | "fullName" | "email">>,
    updatedAt: Date,
  ) {
    const row = await this.getById(t, id);
    if (!row) return null;
    if (
      fields.phone !== undefined &&
      this.rows.some(
        (r) => r.id !== id && r.tenantId === t && r.phone === fields.phone,
      )
    ) {
      this.uniqueViolation("customers_tenant_phone_key");
    }
    Object.assign(row, fields, { updatedAt });
    return row;
  }

  async list(t: string, filter: { q?: string; limit: number }) {
    this.lastList = {
      limit: filter.limit,
      ...(filter.q !== undefined ? { q: filter.q } : {}),
    };
    return this.rows.filter((r) => r.tenantId === t);
  }

  async listAddresses(t: string, customerId: string) {
    return this.addresses.filter(
      (a) =>
        (a as CustomerAddressRecord & { tenantId: string; customerId: string })
          .tenantId === t &&
        (a as CustomerAddressRecord & { customerId: string }).customerId ===
          customerId,
    );
  }
}

function setup() {
  const store = new FakeCustomers();
  const service = new CustomerService({
    store,
    clock: { now: () => new Date("2026-11-12T10:00:00Z") },
  });
  return { store, service };
}

describe("customer validation", () => {
  it("normalizes the phone so 01012345678 and +201012345678 are the same customer", async () => {
    const { service } = setup();
    const created = await service.create(tenantId, { phone: "01012345678" });
    expect(created.phone).toBe("+201012345678");
  });

  it("rejects a phone number that is not an Egyptian mobile", async () => {
    const { service } = setup();
    await expect(
      service.create(tenantId, { phone: "not-a-phone" }),
    ).rejects.toBeInstanceOf(CustomerValidationError);
  });

  it("trims and lowercases the email, and treats an empty email as none", async () => {
    const { service } = setup();
    const withEmail = await service.create(tenantId, {
      phone: "01012345678",
      email: "  Sara@Example.COM ",
    });
    expect(withEmail.email).toBe("sara@example.com");

    const withoutEmail = await service.create(tenantId, {
      phone: "01112345678",
      email: "   ",
    });
    expect(withoutEmail.email).toBeNull();
  });

  it("rejects a malformed email", async () => {
    const { service } = setup();
    await expect(
      service.create(tenantId, { phone: "01012345678", email: "sara@" }),
    ).rejects.toBeInstanceOf(CustomerValidationError);
  });

  it("rejects a full name over 200 characters and stores a blank one as none", async () => {
    const { service } = setup();
    await expect(
      service.create(tenantId, {
        phone: "01012345678",
        fullName: "x".repeat(201),
      }),
    ).rejects.toBeInstanceOf(CustomerValidationError);

    const blank = await service.create(tenantId, {
      phone: "01112345678",
      fullName: "  ",
    });
    expect(blank.fullName).toBeNull();
  });
});

describe("customer uniqueness", () => {
  it("refuses a second customer with the same phone", async () => {
    const { service } = setup();
    await service.create(tenantId, { phone: "01012345678" });
    await expect(
      service.create(tenantId, { phone: "+201012345678" }),
    ).rejects.toBeInstanceOf(DuplicateCustomerPhoneError);
  });

  it("refuses a second customer with the same email", async () => {
    const { service } = setup();
    await service.create(tenantId, {
      phone: "01012345678",
      email: "a@example.com",
    });
    await expect(
      service.create(tenantId, {
        phone: "01112345678",
        email: "A@example.com",
      }),
    ).rejects.toBeInstanceOf(DuplicateCustomerEmailError);
  });
});

describe("customer updates", () => {
  it("updates name and email, and clears the email with null", async () => {
    const { service } = setup();
    const created = await service.create(tenantId, {
      phone: "01012345678",
      email: "a@example.com",
    });
    const updated = await service.update(tenantId, created.id, {
      fullName: "Sara Ahmed",
      email: null,
    });
    expect(updated.fullName).toBe("Sara Ahmed");
    expect(updated.email).toBeNull();
    expect(updated.phone).toBe("+201012345678");
  });

  it("normalizes a new phone and refuses one already taken", async () => {
    const { service } = setup();
    const first = await service.create(tenantId, { phone: "01012345678" });
    await service.create(tenantId, { phone: "01112345678" });
    await expect(
      service.update(tenantId, first.id, { phone: "01112345678" }),
    ).rejects.toBeInstanceOf(DuplicateCustomerPhoneError);

    const moved = await service.update(tenantId, first.id, {
      phone: "01512345678",
    });
    expect(moved.phone).toBe("+201512345678");
  });

  it("reports an unknown customer as not found", async () => {
    const { service } = setup();
    await expect(
      service.update(tenantId, "00000000-0000-4000-8000-00000000ffff", {
        fullName: "X",
      }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });
});

describe("customer reads", () => {
  it("returns the customer with their saved addresses", async () => {
    const { store, service } = setup();
    const created = await service.create(tenantId, { phone: "01012345678" });
    store.addresses.push({
      id: "addr-1",
      tenantId,
      customerId: created.id,
      line1: "12 Tahrir St",
      line2: null,
      city: "Cairo",
      governorateCode: "CAI",
      rawGovernorate: "Cairo",
      createdAt: new Date("2026-11-12T10:00:00Z"),
    } as CustomerAddressRecord);

    const detail = await service.get(tenantId, created.id);
    expect(detail.customer.id).toBe(created.id);
    expect(detail.addresses).toHaveLength(1);
    expect(detail.addresses[0]!.line1).toBe("12 Tahrir St");
  });

  it("passes a trimmed search term and the page size to the store", async () => {
    const { store, service } = setup();
    await service.list(tenantId, { q: "  Sara  ", limit: 25 });
    expect(store.lastList).toEqual({ q: "Sara", limit: 25 });
  });
});
