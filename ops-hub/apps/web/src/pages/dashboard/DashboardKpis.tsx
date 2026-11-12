import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { useT } from "../../lib/i18n";
import { formatNumber } from "../../lib/format";
import { StatCard, Tag } from "../../components/ui";

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

/** Subtle "no endpoint yet" KPI: an em-dash value, never a fabricated number. */
function ComingSoonStat({ label, icon }: { label: string; icon: ReactNode }) {
  const t = useT();
  return (
    <StatCard
      label={label}
      value="—"
      icon={icon}
      hint={
        <span className="flex flex-wrap items-center gap-1.5">
          <Tag tone="secondary">{t("dashboard.kpi.comingSoon")}</Tag>
          <span>{t("dashboard.kpi.comingSoonHint")}</span>
        </span>
      }
    />
  );
}

/**
 * KPI row (UI_PLAN §5). Only KPIs with a real data source show numbers;
 * the rest are honest "coming soon" tiles until the API ships aggregates.
 */
export function DashboardKpis({
  openExceptions,
  isLoading,
}: DashboardKpisProps) {
  const t = useT();

  return (
    <section
      aria-label={t("dashboard.title")}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Link
        to="/exceptions"
        className="group rounded-lg transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary hover:shadow-md"
        aria-label={`${t("dashboard.kpi.openExceptions")} — ${t("dashboard.viewOrder")}`}
      >
        <StatCard
          label={t("dashboard.kpi.openExceptions")}
          value={
            openExceptions === undefined ? "—" : formatNumber(openExceptions)
          }
          hint={t("dashboard.kpi.openExceptionsHint")}
          icon={<AlertIcon />}
          loading={isLoading && openExceptions === undefined}
        />
      </Link>
      <ComingSoonStat
        label={t("dashboard.kpi.onHoldOrders")}
        icon={<PauseIcon />}
      />
      <ComingSoonStat label={t("dashboard.kpi.lowStock")} icon={<BoxIcon />} />
      <ComingSoonStat
        label={t("dashboard.kpi.ordersToday")}
        icon={<PlusIcon />}
      />
    </section>
  );
}
