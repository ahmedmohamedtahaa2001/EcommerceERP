import { randomUUID } from "node:crypto";

import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CustomerNotFoundError,
  DuplicateCustomerEmailError,
  DuplicateCustomerPhoneError,
} from "../src/customers/errors";
import { PgCustomerStore } from "../src/customers/pg-store";
import { CustomerService } from "../src/customers/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantId = "00000000-0000-4000-8000-00000000b002";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const service = new CustomerService({
  store: new PgCustomerStore(pool),
  clock: systemClock,
});

describe.skipIf(!runDbTests)("Customers against Postgres", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query("delete from addresses where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from customers where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from tenants where id = $1", [tenantId]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'customers-test', 'Customers Test')",
      [tenantId],
    );
  });

  afterAll(async () => {
    await client.end();
    await pool.end();
  });

  it("creates, reads and updates a customer", async () => {
    const created = await service.create(tenantId, {
      phone: "01012345678",
      fullName: "Sara Ahmed",
      email: "Sara@Example.com",
    });
    expect(created.phone).toBe("+201012345678");
    expect(created.email).toBe("sara@example.com");

    const { customer } = await service.get(tenantId, created.id);
    expect(customer.fullName).toBe("Sara Ahmed");

    const updated = await service.update(tenantId, created.id, {
      fullName: "Sara A. Mahmoud",
      email: null,
    });
    expect(updated.fullName).toBe("Sara A. Mahmoud");
    expect(updated.email).toBeNull();
  });

  it("enforces unique phone and email per tenant in the database", async () => {
    await service.create(tenantId, {
      phone: "01111111111",
      email: "dup@example.com",
    });
    await expect(
      service.create(tenantId, { phone: "+201111111111" }),
    ).rejects.toBeInstanceOf(DuplicateCustomerPhoneError);
    await expect(
      service.create(tenantId, {
        phone: "01122222222",
        email: "DUP@example.com",
      }),
    ).rejects.toBeInstanceOf(DuplicateCustomerEmailError);
  });

  it("searches by name, phone and email, and treats wildcard characters literally", async () => {
    await service.create(tenantId, {
      phone: "01233333333",
      fullName: "Omar 50% Off",
    });
    const byName = await service.list(tenantId, { q: "omar", limit: 50 });
    expect(byName.some((c) => c.fullName === "Omar 50% Off")).toBe(true);

    const byPhone = await service.list(tenantId, {
      q: "01233333333",
      limit: 50,
    });
    expect(byPhone).toHaveLength(1);

    const literalPercent = await service.list(tenantId, {
      q: "50%",
      limit: 50,
    });
    expect(literalPercent).toHaveLength(1);
    const wildcardOnly = await service.list(tenantId, { q: "%", limit: 50 });
    expect(wildcardOnly.length).toBeLessThan(
      (await service.list(tenantId, { limit: 500 })).length,
    );
  });

  it("pages with a keyset cursor without repeating customers", async () => {
    const all = await service.list(tenantId, { limit: 500 });
    const first = await service.list(tenantId, { limit: 2 });
    const last = first[first.length - 1]!;
    const second = await service.list(tenantId, {
      limit: 2,
      cursor: { createdAt: last.createdAt.toISOString(), id: last.id },
    });
    const ids = [...first, ...second].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(all.slice(0, 4).map((c) => c.id));
  });

  it("returns a customer's saved addresses with their profile", async () => {
    const created = await service.create(tenantId, { phone: "01544444444" });
    await client.query(
      `insert into addresses (id, tenant_id, customer_id, line1, city, governorate_code, raw_governorate)
       values ($1, $2, $3, '5 Corniche Rd', 'Alexandria', 'ALX', 'Alexandria')`,
      [randomUUID(), tenantId, created.id],
    );
    const detail = await service.get(tenantId, created.id);
    expect(detail.addresses).toHaveLength(1);
    expect(detail.addresses[0]!.line1).toBe("5 Corniche Rd");
  });

  it("reports a missing customer as not found on update", async () => {
    await expect(
      service.update(tenantId, randomUUID(), { fullName: "Nobody" }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });
});
