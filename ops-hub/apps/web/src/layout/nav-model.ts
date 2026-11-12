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
      { labelKey: "nav.orders", to: "/orders", icon: "cart" },
      { labelKey: "nav.exceptions", to: "/exceptions", icon: "alert" },
    ],
  },
  {
    labelKey: "nav.section.inventory",
    items: [
      {
        labelKey: "nav.availability",
        to: "/inventory/availability",
        icon: "boxes",
      },
      { labelKey: "nav.movements", to: "/inventory/movements", icon: "swap" },
      {
        labelKey: "nav.adjustments",
        to: "/inventory/adjustments",
        icon: "clipboard",
      },
      {
        labelKey: "nav.reservations",
        to: "/inventory/reservations",
        icon: "bookmark",
      },
      { labelKey: "nav.locations", to: "/inventory/locations", icon: "pin" },
    ],
  },
  {
    labelKey: "nav.section.catalog",
    items: [
      { labelKey: "nav.products", to: "/products", icon: "package" },
      { labelKey: "nav.productImport", to: "/products/import", icon: "upload" },
      { labelKey: "nav.bulk", to: "/bulk", icon: "package" },
    ],
  },
  {
    labelKey: "nav.section.customers",
    items: [{ labelKey: "nav.customers", to: "/customers", icon: "users" }],
  },
  {
    labelKey: "nav.section.data",
    items: [{ labelKey: "nav.exports", to: "/exports", icon: "download" }],
  },
  {
    labelKey: "nav.section.analytics",
    items: [
      { labelKey: "nav.analytics", to: "/analytics", icon: "chart" },
      { labelKey: "nav.reports", to: "/reports", icon: "chart" },
    ],
  },
  {
    labelKey: "nav.section.admin",
    items: [
      { labelKey: "nav.audit", to: "/audit", icon: "scroll" },
      { labelKey: "nav.apiKeys", to: "/api-keys", icon: "key" },
      { labelKey: "nav.users", to: "/users", icon: "users" },
      { labelKey: "nav.settings", to: "/settings", icon: "settings" },
      { labelKey: "nav.agents", to: "/agents", icon: "bot" },
    ],
  },
] as const;
