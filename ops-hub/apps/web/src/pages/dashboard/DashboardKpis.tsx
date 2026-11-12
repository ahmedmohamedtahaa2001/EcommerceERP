import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { useT } from "../../lib/i18n";
import { formatNumber } from "../../lib/format";
import { useQuery } from "@tanstack/react-query";

import { StatCard } from "../../components/ui";
import { useSession } from "../../lib/auth/store";
import { listOrders } from "../../lib/api/orders";
import { listReorderSuggestions } from "../../lib/api/inventory";
import { getDailyReport } from "../../lib/api/reports";
import { isoDay } from "../reports/report-format";

export interface DashboardKpisProps {
  /** Count of open exceptions; `undefined` while the query is loading. */
  openExceptions: number | undefined;
  isLoading: boolean;
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function AlertIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="m10.3 3.9-8.5 14.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="7" y="5" width="3" height="14" rx="1" />
      <rect x="14" y="5" width="3" height="14" rx="1" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function useCan(permission: string): boolean {
  const { session } = useSession();
  return session?.user.permissions?.includes(permission) ?? false;
}

/** A KPI tile that links to the screen behind its number; a dash means no access or no answer. */
function LinkedStat({
  to,
  label,
  hint,
  icon,
  value,
  loading,
}: {
  to: string;
  label: string;
  hint: string;
  icon: ReactNode;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary hover:shadow-md"
    >
      <StatCard
        label={label}
        value={value === undefined ? "—" : formatNumber(value)}
        hint={hint}
        icon={icon}
        loading={loading}
      />
    </Link>
  );
}

/** KPI row: every tile reads a real source; nothing is estimated or invented. */
export function DashboardKpis({
  openExceptions,
  isLoading,
}: DashboardKpisProps) {
  const t = useT();
  const canOrders = useCan("orders:read");
  const canInventory = useCan("inventory:read");
  const canReports = useCan("reports:read");
  const today = isoDay(new Date());

  const onHold = useQuery({
    queryKey: ["orders", "list", "on_hold"],
    queryFn: () => listOrders({ status: "on_hold" }),
    enabled: canOrders,
  });
  const lowStock = useQuery({
    queryKey: ["reorder-suggestions"],
    queryFn: listReorderSuggestions,
    enabled: canInventory,
  });
  const daily = useQuery({
    queryKey: ["reports", "daily", today],
    queryFn: () => getDailyReport(today),
    enabled: canReports,
  });

  return (
    <section
      aria-label={t("dashboard.title")}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <LinkedStat
        to="/exceptions"
        label={t("dashboard.kpi.openExceptions")}
        hint={t("dashboard.kpi.openExceptionsHint")}
        icon={<AlertIcon />}
        value={openExceptions}
        loading={isLoading && openExceptions === undefined}
      />
      <LinkedStat
        to="/orders?status=on_hold"
        label={t("dashboard.kpi.onHoldOrders")}
        hint={t("dashboard.kpi.onHoldHint")}
        icon={<PauseIcon />}
        value={onHold.data?.orders.length}
        loading={onHold.isLoading && canOrders}
      />
      <LinkedStat
        to="/inventory/availability"
        label={t("dashboard.kpi.lowStock")}
        hint={t("dashboard.kpi.lowStockHint")}
        icon={<BoxIcon />}
        value={lowStock.data?.suggestions.length}
        loading={lowStock.isLoading && canInventory}
      />
      <LinkedStat
        to="/reports"
        label={t("dashboard.kpi.ordersToday")}
        hint={t("dashboard.kpi.ordersTodayHint")}
        icon={<PlusIcon />}
        value={daily.data?.ordersCreated}
        loading={daily.isLoading && canReports}
      />
    </section>
  );
}
