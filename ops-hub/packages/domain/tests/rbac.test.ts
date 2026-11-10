import { describe, expect, it } from "vitest";

import {
  can,
  isRole,
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from "../src/index";

describe("owner", () => {
  it.each(PERMISSIONS)("grants %s", (permission) => {
    expect(can("owner", permission)).toBe(true);
  });
});

describe("role matrix", () => {
  const allowed: [Role, Permission][] = [
    ["manager", "orders:write"],
    ["manager", "inventory:write"],
    ["manager", "audit:read"],
    ["sales_agent", "orders:write"],
    ["sales_agent", "customers:write"],
    ["warehouse", "inventory:write"],
    ["warehouse", "shipments:write"],
    ["finance", "refunds:approve"],
    ["finance", "reports:read"],
    ["support", "customers:write"],
    ["viewer", "orders:read"],
    ["viewer", "inventory:read"],
  ];

  const denied: [Role, Permission][] = [
    ["manager", "refunds:approve"],
    ["manager", "api_keys:write"],
    ["sales_agent", "refunds:approve"],
    ["sales_agent", "inventory:write"],
    ["warehouse", "orders:write"],
    ["warehouse", "refunds:read"],
    ["finance", "orders:write"],
    ["finance", "customers:write"],
    ["support", "refunds:approve"],
    ["support", "audit:read"],
    ["viewer", "orders:write"],
    ["viewer", "refunds:read"],
    ["viewer", "settings:write"],
  ];

  it.each(allowed)("allows %s to %s", (role, permission) => {
    expect(can(role, permission)).toBe(true);
  });

  it.each(denied)("denies %s when they try to %s", (role, permission) => {
    expect(can(role, permission)).toBe(false);
  });

  it("grants nothing when the user has no membership role", () => {
    expect(can(null, "orders:read")).toBe(false);
    expect(can(null, "reports:read")).toBe(false);
  });

  it("gives every role at least one permission", () => {
    for (const role of ROLES) {
      expect(PERMISSIONS.some((permission) => can(role, permission))).toBe(
        true,
      );
    }
  });
});

describe("isRole", () => {
  it("accepts known roles and rejects everything else", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("viewer")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
