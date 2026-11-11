export const PERMISSIONS = [
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
  "catalog:read",
  "catalog:write",
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
    "catalog:read",
    "catalog:write",
  ],
  sales_agent: [
    "orders:read",
    "orders:write",
    "shipments:read",
    "refunds:read",
    "customers:read",
    "customers:write",
    "catalog:read",
  ],
  warehouse: [
    "orders:read",
    "inventory:read",
    "inventory:write",
    "shipments:read",
    "shipments:write",
    "catalog:read",
  ],
  finance: [
    "orders:read",
    "refunds:read",
    "refunds:approve",
    "reports:read",
    "audit:read",
    "catalog:read",
  ],
  support: [
    "orders:read",
    "shipments:read",
    "refunds:read",
    "customers:read",
    "customers:write",
    "catalog:read",
  ],
  viewer: [
    "orders:read",
    "inventory:read",
    "shipments:read",
    "reports:read",
    "catalog:read",
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
