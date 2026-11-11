export const PERMISSIONS = [
  "products:read",
  "products:write",
  "orders:read",
  "orders:write",
  "inventory:read",
  "inventory:write",
  "shipments:read",
  "shipments:write",
  "refunds:read",
  "refunds:approve",
  "customers:read",
  "customers:write",
  "reports:read",
  "audit:read",
  "users:read",
  "users:write",
  "api_keys:read",
  "api_keys:write",
  "settings:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "owner",
  "manager",
  "sales_agent",
  "warehouse",
  "finance",
  "support",
  "viewer",
] as const;

export type Role = (typeof ROLES)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  manager: [
    "products:read",
    "products:write",
    "orders:read",
    "orders:write",
    "inventory:read",
    "inventory:write",
    "shipments:read",
    "shipments:write",
    "refunds:read",
    "customers:read",
    "customers:write",
    "reports:read",
    "audit:read",
    "users:read",
  ],
  sales_agent: [
    "products:read",
    "orders:read",
    "orders:write",
    "shipments:read",
    "refunds:read",
    "customers:read",
    "customers:write",
  ],
  warehouse: [
    "products:read",
    "orders:read",
    "inventory:read",
    "inventory:write",
    "shipments:read",
    "shipments:write",
  ],
  finance: [
    "orders:read",
    "refunds:read",
    "refunds:approve",
    "reports:read",
    "audit:read",
  ],
  support: [
    "products:read",
    "orders:read",
    "shipments:read",
    "refunds:read",
    "customers:read",
    "customers:write",
  ],
  viewer: [
    "products:read",
    "orders:read",
    "inventory:read",
    "shipments:read",
    "reports:read",
  ],
};

const GRANTS = new Map<Role, ReadonlySet<Permission>>(
  (Object.entries(ROLE_PERMISSIONS) as [Role, readonly Permission[]][]).map(
    ([role, permissions]) => [role, new Set(permissions)],
  ),
);

export function isRole(value: string | null | undefined): value is Role {
  return (
    value !== null &&
    value !== undefined &&
    (ROLES as readonly string[]).includes(value)
  );
}

/** A missing role (no membership) grants nothing. */
export function can(role: Role | null, permission: Permission): boolean {
  return role !== null && GRANTS.get(role)?.has(permission) === true;
}
