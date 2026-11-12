import { describe, expect, it } from "vitest";

import { permissionsFor } from "../src/rbac";

describe("permissionsFor", () => {
  it("gives a person without a role no permissions", () => {
    expect(permissionsFor(null)).toEqual([]);
  });

  it("gives the owner every permission", () => {
    expect(permissionsFor("owner")).toContain("users:write");
    expect(permissionsFor("owner")).toContain("settings:write");
  });

  it("keeps sales away from warehouse and team administration", () => {
    const sales = permissionsFor("sales_agent");
    expect(sales).toContain("orders:write");
    expect(sales).not.toContain("inventory:write");
    expect(sales).not.toContain("users:read");
  });

  it("keeps warehouse staff to stock and shipping", () => {
    const warehouse = permissionsFor("warehouse");
    expect(warehouse).toContain("inventory:write");
    expect(warehouse).not.toContain("customers:read");
    expect(warehouse).not.toContain("reports:read");
  });
});
