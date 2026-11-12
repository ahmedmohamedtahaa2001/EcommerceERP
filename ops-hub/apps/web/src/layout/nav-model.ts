export type NavIconKey =
  | "dashboard"
  | "cart"
  | "alert"
  | "boxes"
  | "swap"
  | "clipboard"
  | "bookmark"
  | "pin"
  | "package"
  | "upload"
  | "download"
  | "users"
  | "chart"
  | "scroll"
  | "key"
  | "settings"
  | "bot";

export interface NavItem {
  /** i18n key for the label. */
  labelKey: string;
  to: string;
  icon: NavIconKey;
  /** Permission needed to see the item. Absent means every signed-in user sees it. */
  permission?: string;
}

export interface NavSection {
  /** i18n key for the section heading. */
  labelKey: string;
  items: NavItem[];
}

/** Sidebar navigation structure (UI_PLAN §6), in display order. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    labelKey: "nav.section.operations",
    items: [
      { labelKey: "nav.dashboard", to: "/", icon: "dashboard" },
      {
        labelKey: "nav.orders",
        to: "/orders",
        icon: "cart",
        permission: "orders:read",
      },
      {
        labelKey: "nav.exceptions",
        to: "/exceptions",
        icon: "alert",
        permission: "orders:read",
      },
    ],
  },
  {
    labelKey: "nav.section.inventory",
    items: [
      {
        labelKey: "nav.availability",
        to: "/inventory/availability",
        icon: "boxes",
        permission: "inventory:read",
      },
      {
        labelKey: "nav.movements",
        to: "/inventory/movements",
        icon: "swap",
        permission: "inventory:read",
      },
      {
        labelKey: "nav.adjustments",
        to: "/inventory/adjustments",
        icon: "clipboard",
        permission: "inventory:write",
      },
      {
        labelKey: "nav.transfers",
        to: "/inventory/transfers",
        icon: "swap",
        permission: "inventory:write",
      },
      {
        labelKey: "nav.reservations",
        to: "/inventory/reservations",
        icon: "bookmark",
        permission: "inventory:read",
      },
      {
        labelKey: "nav.locations",
        to: "/inventory/locations",
        icon: "pin",
        permission: "inventory:read",
      },
    ],
  },
  {
    labelKey: "nav.section.catalog",
    items: [
      {
        labelKey: "nav.products",
        to: "/products",
        icon: "package",
        permission: "products:read",
      },
      {
        labelKey: "nav.productImport",
        to: "/products/import",
        icon: "upload",
        permission: "products:write",
      },
      {
        labelKey: "nav.bulk",
        to: "/bulk",
        icon: "package",
        permission: "products:write",
      },
    ],
  },
  {
    labelKey: "nav.section.customers",
    items: [
      {
        labelKey: "nav.customers",
        to: "/customers",
        icon: "users",
        permission: "customers:read",
      },
    ],
  },
  {
    labelKey: "nav.section.data",
    items: [
      {
        labelKey: "nav.exports",
        to: "/exports",
        icon: "download",
        permission: "orders:read",
      },
    ],
  },
  {
    labelKey: "nav.section.analytics",
    items: [
      {
        labelKey: "nav.analytics",
        to: "/analytics",
        icon: "chart",
        permission: "reports:read",
      },
      {
        labelKey: "nav.reports",
        to: "/reports",
        icon: "chart",
        permission: "reports:read",
      },
    ],
  },
  {
    labelKey: "nav.section.admin",
    items: [
      {
        labelKey: "nav.audit",
        to: "/audit",
        icon: "scroll",
        permission: "audit:read",
      },
      {
        labelKey: "nav.apiKeys",
        to: "/api-keys",
        icon: "key",
        permission: "api_keys:read",
      },
      {
        labelKey: "nav.users",
        to: "/users",
        icon: "users",
        permission: "users:read",
      },
      {
        labelKey: "nav.settings",
        to: "/settings",
        icon: "settings",
        permission: "settings:read",
      },
      {
        labelKey: "nav.agents",
        to: "/agents",
        icon: "bot",
        permission: "settings:write",
      },
    ],
  },
] as const;

/** Keeps only the items the person's permissions allow, and drops sections left empty. */
export function visibleNavSections(
  sections: readonly NavSection[],
  permissions: readonly string[],
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.permission === undefined ||
          permissions.includes(item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
