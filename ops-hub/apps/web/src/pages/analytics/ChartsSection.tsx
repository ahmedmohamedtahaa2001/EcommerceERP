import { Skeleton } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { formatNumber } from "../../lib/format";
import { BarDistribution, type BarItem } from "./charts";
import {
  isKnownReasonCode,
  type ExceptionStats,
  type ProductStats,
} from "./hooks";

/**
 * Real-distribution charts (presentation only): exceptions by reason_code
 * and products by status — both computed from live list endpoints. No chart
 * library, no fabricated series.
 */

export function ChartsSection({
  exceptionStats,
  productStats,
}: {
  exceptionStats: ExceptionStats | undefined;
  productStats: ProductStats | undefined;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ExceptionsChart stats={exceptionStats} />
      <ProductsChart stats={productStats} />
    </div>
  );
}

function ExceptionsChart({ stats }: { stats: ExceptionStats | undefined }) {
  const t = useT();
  if (stats === undefined) {
    return <ChartSkeleton title={t("analytics.chart.exceptions.title")} />;
  }
  const items: readonly BarItem[] = stats.reasons.map((reason) => ({
    id: reason.code,
    label: reasonLabel(reason.code, t),
    count: reason.count,
    tone: "alert",
  }));
  const top = stats.reasons[0];
  const topLabel = top === undefined ? "" : reasonLabel(top.code, t);
  const topCount = formatNumber(top?.count ?? 0);
  return (
    <BarDistribution
      title={t("analytics.chart.exceptions.title")}
      items={items}
      ariaLabel={t("analytics.chart.exceptions.aria", {
        count: formatNumber(stats.open),
        top: topLabel,
        topCount,
      })}
      summary={t("analytics.chart.exceptions.summary", {
        count: formatNumber(stats.open),
        top: topLabel,
        topCount,
      })}
      emptyText={t("analytics.chart.exceptions.empty")}
    />
  );
}

function ProductsChart({ stats }: { stats: ProductStats | undefined }) {
  const t = useT();
  if (stats === undefined) {
    return <ChartSkeleton title={t("analytics.chart.products.title")} />;
  }
  const toneByStatus: Record<string, BarItem["tone"]> = {
    active: "success",
    draft: "warning",
    archived: "primary",
  };
  const items: readonly BarItem[] = stats.statuses.map((entry) => ({
    id: entry.status,
    label: t(`analytics.productStatus.${entry.status}`),
    count: entry.count,
    tone: toneByStatus[entry.status] ?? "primary",
  }));
  const params = productParams(stats);
  return (
    <BarDistribution
      title={t("analytics.chart.products.title")}
      items={items}
      ariaLabel={t("analytics.chart.products.aria", {
        total: formatNumber(stats.total),
        ...params,
      })}
      summary={t("analytics.chart.products.summary", {
        total: formatNumber(stats.total),
        ...params,
      })}
      emptyText={t("analytics.chart.products.empty")}
    />
  );
}

function productParams(stats: ProductStats): Record<string, string> {
  const byStatus = new Map(
    stats.statuses.map((entry) => [entry.status, entry.count]),
  );
  return {
    active: formatNumber(byStatus.get("active") ?? 0),
    draft: formatNumber(byStatus.get("draft") ?? 0),
    archived: formatNumber(byStatus.get("archived") ?? 0),
  };
}

/** Known codes reuse the global `reason.*` keys; unknown codes show verbatim. */
function reasonLabel(code: string, t: ReturnType<typeof useT>): string {
  if (code === "DUPLICATE_SUSPECTED") {
    return t("analytics.reason.duplicate");
  }
  if (isKnownReasonCode(code)) {
    return t(`reason.${code}`);
  }
  return t("analytics.reason.unknown", { code });
}

function ChartSkeleton({ title }: { title: string }) {
  const t = useT();
  return (
    <div
      className="rounded-lg bg-surface p-4 shadow-sm"
      role="status"
      aria-busy="true"
    >
      <h2 className="text-subtitle2 font-bold text-ink-900">{title}</h2>
      <div className="mt-4 flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 flex-1 rounded-pill" />
          </div>
        ))}
      </div>
      <span className="sr-only">{t("state.loading")}</span>
    </div>
  );
}
