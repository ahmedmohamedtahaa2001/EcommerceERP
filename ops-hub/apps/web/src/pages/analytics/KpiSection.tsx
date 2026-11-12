import { Button, StatCard } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { formatNumber } from "../../lib/format";
import type { KpiSources, ProductStats } from "./hooks";

/**
 * Live KPI grid (presentation only): open/overdue exceptions, product
 * totals and location count — every number is computed from real list
 * endpoints, with skeletons while loading and an honest per-query error
 * state with retry.
 */

export function KpiSection({ sources }: { sources: KpiSources }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExceptionsKpi exceptions={sources.exceptions} />
      <ProductsKpi products={sources.products} />
      <LocationsKpi locations={sources.locations} />
    </div>
  );
}

function ExceptionsKpi({
  exceptions,
}: {
  exceptions: KpiSources["exceptions"];
}) {
  const t = useT();
  if (exceptions.state === "error") {
    return <KpiErrorCard onRetry={exceptions.onRetry} />;
  }
  const stats = exceptions.stats;
  return (
    <>
      <StatCard
        label={t("analytics.kpi.openExceptions")}
        value={stats === undefined ? "" : formatNumber(stats.open)}
        loading={exceptions.state === "loading"}
        hint={
          stats === undefined
            ? undefined
            : t("analytics.kpi.openExceptionsHint", {
                count: formatNumber(stats.overdue),
              })
        }
      />
      <StatCard
        label={t("analytics.kpi.overdueExceptions")}
        value={stats === undefined ? "" : formatNumber(stats.overdue)}
        loading={exceptions.state === "loading"}
        hint={
          stats === undefined
            ? undefined
            : t("analytics.kpi.overdueExceptionsHint", {
                total: formatNumber(stats.open),
              })
        }
      />
    </>
  );
}

function ProductsKpi({ products }: { products: KpiSources["products"] }) {
  const t = useT();
  if (products.state === "error") {
    return <KpiErrorCard onRetry={products.onRetry} />;
  }
  const stats = products.stats;
  return (
    <StatCard
      label={t("analytics.kpi.products")}
      value={stats === undefined ? "" : formatNumber(stats.total)}
      loading={products.state === "loading"}
      hint={
        stats === undefined
          ? undefined
          : t("analytics.kpi.productsHint", productParams(stats))
      }
    />
  );
}

function LocationsKpi({ locations }: { locations: KpiSources["locations"] }) {
  const t = useT();
  if (locations.state === "error") {
    return <KpiErrorCard onRetry={locations.onRetry} />;
  }
  return (
    <StatCard
      label={t("analytics.kpi.locations")}
      value={formatNumber(locations.count)}
      loading={locations.state === "loading"}
      hint={t("analytics.kpi.locationsHint")}
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

function KpiErrorCard({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-sm">
      <p className="text-body2 text-ink-700">{t("analytics.kpi.loadFailed")}</p>
      <Button
        variant="outlined"
        size="sm"
        className="self-start"
        onClick={onRetry}
      >
        {t("action.retry")}
      </Button>
    </div>
  );
}
