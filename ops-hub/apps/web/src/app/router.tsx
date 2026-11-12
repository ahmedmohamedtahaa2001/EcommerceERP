import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "../layout/AppShell";
import { ProtectedRoute } from "../layout/ProtectedRoute";

/**
 * Complete route table from UI_PLAN §7. Every page is lazy-loaded via React
 * Router's native `lazy` route property (NOT React.lazy + `element`), so
 * code-splitting happens inside a transition and never suspends during
 * synchronous input (which is what triggered the "component suspended while
 * responding to synchronous input" crash). Page agents replace file contents
 * (named exports) — never these routes.
 */

// Vite needs statically analyzable dynamic imports for code-splitting, so we
// list each import explicitly (Vite splits on literal import() paths).
const lazyImports = {
  LoginPage: () =>
    import("../pages/auth/LoginPage").then((m) => ({ Component: m.LoginPage })),
  DashboardPage: () =>
    import("../pages/dashboard/DashboardPage").then((m) => ({
      Component: m.DashboardPage,
    })),
  OrdersPage: () =>
    import("../pages/orders/OrdersPage").then((m) => ({
      Component: m.OrdersPage,
    })),
  ReportsPage: () =>
    import("../pages/reports/ReportsPage").then((m) => ({
      Component: m.ReportsPage,
    })),
  UsersPage: () =>
    import("../pages/users/UsersPage").then((m) => ({
      Component: m.UsersPage,
    })),
  BulkPage: () =>
    import("../pages/bulk/BulkPage").then((m) => ({
      Component: m.BulkPage,
    })),
  ExportsPage: () =>
    import("../pages/exports/ExportsPage").then((m) => ({
      Component: m.ExportsPage,
    })),
  NewOrderPage: () =>
    import("../pages/orders/NewOrderPage").then((m) => ({
      Component: m.NewOrderPage,
    })),
  OrderDetailPage: () =>
    import("../pages/orders/OrderDetailPage").then((m) => ({
      Component: m.OrderDetailPage,
    })),
  ExceptionsPage: () =>
    import("../pages/exceptions/ExceptionsPage").then((m) => ({
      Component: m.ExceptionsPage,
    })),
  ProductsPage: () =>
    import("../pages/products/ProductsPage").then((m) => ({
      Component: m.ProductsPage,
    })),
  ProductDetailPage: () =>
    import("../pages/products/ProductDetailPage").then((m) => ({
      Component: m.ProductDetailPage,
    })),
  ProductImportPage: () =>
    import("../pages/products/ProductImportPage").then((m) => ({
      Component: m.ProductImportPage,
    })),
  AvailabilityPage: () =>
    import("../pages/inventory/AvailabilityPage").then((m) => ({
      Component: m.AvailabilityPage,
    })),
  MovementsPage: () =>
    import("../pages/inventory/MovementsPage").then((m) => ({
      Component: m.MovementsPage,
    })),
  AdjustmentsPage: () =>
    import("../pages/inventory/AdjustmentsPage").then((m) => ({
      Component: m.AdjustmentsPage,
    })),
  TransfersPage: () =>
    import("../pages/inventory/TransfersPage").then((m) => ({
      Component: m.TransfersPage,
    })),
  ReservationsPage: () =>
    import("../pages/inventory/ReservationsPage").then((m) => ({
      Component: m.ReservationsPage,
    })),
  LocationsPage: () =>
    import("../pages/inventory/LocationsPage").then((m) => ({
      Component: m.LocationsPage,
    })),
  CustomersPage: () =>
    import("../pages/customers/CustomersPage").then((m) => ({
      Component: m.CustomersPage,
    })),
  NewCustomerPage: () =>
    import("../pages/customers/NewCustomerPage").then((m) => ({
      Component: m.NewCustomerPage,
    })),
  CustomerDetailPage: () =>
    import("../pages/customers/CustomerDetailPage").then((m) => ({
      Component: m.CustomerDetailPage,
    })),
  AnalyticsPage: () =>
    import("../pages/analytics/AnalyticsPage").then((m) => ({
      Component: m.AnalyticsPage,
    })),
  AuditLogPage: () =>
    import("../pages/admin/AuditLogPage").then((m) => ({
      Component: m.AuditLogPage,
    })),
  ApiKeysPage: () =>
    import("../pages/admin/ApiKeysPage").then((m) => ({
      Component: m.ApiKeysPage,
    })),
  SettingsPage: () =>
    import("../pages/admin/SettingsPage").then((m) => ({
      Component: m.SettingsPage,
    })),
  AgentsPage: () =>
    import("../pages/admin/AgentsPage").then((m) => ({
      Component: m.AgentsPage,
    })),
  TrackPage: () =>
    import("../pages/tracking/TrackPage").then((m) => ({
      Component: m.TrackPage,
    })),
  NotFoundPage: () =>
    import("../pages/system/NotFoundPage").then((m) => ({
      Component: m.NotFoundPage,
    })),
};

export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: lazyImports.LoginPage,
  },
  {
    path: "/track",
    lazy: lazyImports.TrackPage,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, lazy: lazyImports.DashboardPage },
      { path: "orders", lazy: lazyImports.OrdersPage },
      { path: "orders/new", lazy: lazyImports.NewOrderPage },
      { path: "orders/:orderId", lazy: lazyImports.OrderDetailPage },
      { path: "exceptions", lazy: lazyImports.ExceptionsPage },
      { path: "products", lazy: lazyImports.ProductsPage },
      { path: "products/import", lazy: lazyImports.ProductImportPage },
      { path: "products/:productId", lazy: lazyImports.ProductDetailPage },
      { path: "inventory/availability", lazy: lazyImports.AvailabilityPage },
      { path: "inventory/movements", lazy: lazyImports.MovementsPage },
      { path: "inventory/adjustments", lazy: lazyImports.AdjustmentsPage },
      { path: "inventory/transfers", lazy: lazyImports.TransfersPage },
      { path: "inventory/reservations", lazy: lazyImports.ReservationsPage },
      { path: "inventory/locations", lazy: lazyImports.LocationsPage },
      { path: "customers", lazy: lazyImports.CustomersPage },
      { path: "exports", lazy: lazyImports.ExportsPage },
      { path: "bulk", lazy: lazyImports.BulkPage },
      { path: "users", lazy: lazyImports.UsersPage },
      { path: "reports", lazy: lazyImports.ReportsPage },
      { path: "customers/new", lazy: lazyImports.NewCustomerPage },
      { path: "customers/:customerId", lazy: lazyImports.CustomerDetailPage },
      { path: "analytics", lazy: lazyImports.AnalyticsPage },
      { path: "audit", lazy: lazyImports.AuditLogPage },
      { path: "api-keys", lazy: lazyImports.ApiKeysPage },
      { path: "settings", lazy: lazyImports.SettingsPage },
      { path: "agents", lazy: lazyImports.AgentsPage },
      { path: "*", lazy: lazyImports.NotFoundPage },
    ],
  },
]);
