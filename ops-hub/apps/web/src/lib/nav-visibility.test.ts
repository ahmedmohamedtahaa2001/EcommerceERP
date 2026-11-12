import { describe, expect, it } from "vitest";

import { NAV_SECTIONS, visibleNavSections } from "../layout/nav-model";

function paths(permissions: string[]): string[] {
  return visibleNavSections(NAV_SECTIONS, permissions).flatMap((section) =>
    section.items.map((item) => item.to),
  );
}

describe("visibleNavSections", () => {
  it("shows every module to someone holding every permission", () => {
    const all = NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => item.to),
    );
    const everything = [
      "orders:read",
      "inventory:read",
      "inventory:write",
      "products:read",
      "products:write",
      "customers:read",
      "reports:read",
      "audit:read",
      "api_keys:read",
      "users:read",
      "settings:read",
      "settings:write",
    ];
    expect(paths(everything)).toEqual(all);
  });

  it("shows a sales person the sales modules only", () => {
    const sales = paths([
      "products:read",
      "orders:read",
      "orders:write",
      "customers:read",
      "customers:write",
    ]);
    expect(sales).toEqual(
      expect.arrayContaining(["/", "/orders", "/customers", "/products"]),
    );
    expect(sales).not.toContain("/inventory/locations");
    expect(sales).not.toContain("/users");
    expect(sales).not.toContain("/audit");
  });

  it("shows a warehouse person the warehouse modules, not sales reporting", () => {
    const warehouse = paths([
      "products:read",
      "orders:read",
      "inventory:read",
      "inventory:write",
    ]);
    expect(warehouse).toEqual(
      expect.arrayContaining(["/inventory/locations", "/inventory/movements"]),
    );
    expect(warehouse).not.toContain("/reports");
    expect(warehouse).not.toContain("/customers");
  });

  it("keeps the dashboard for everyone, even with no permissions", () => {
    expect(paths([])).toEqual(["/"]);
  });

  it("drops a section once none of its items remain", () => {
    const sections = visibleNavSections(NAV_SECTIONS, []);
    expect(sections.every((section) => section.items.length > 0)).toBe(true);
  });
});
