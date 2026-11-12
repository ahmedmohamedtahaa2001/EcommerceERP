import { useT } from "../../lib/i18n";
import { ChartsSection } from "./ChartsSection";
import { KpiSection } from "./KpiSection";
import { Link } from "react-router-dom";
import type { KpiSources } from "./hooks";

/**
 * Presentational analytics view (no queries here — see AnalyticsPage).
 * Everything shown is real computed data or an explicitly gold "قريباً"
 * roadmap card; fake charts and fake numbers are forbidden.
 */

export function AnalyticsView({ sources }: { sources: KpiSources }) {
  const t = useT();

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="analytics-real-kpis"
        className="flex flex-col gap-3"
      >
        <h2
          id="analytics-real-kpis"
          className="text-subtitle1 font-bold text-ink-900"
        >
          {t("analytics.section.realKpis")}
        </h2>
        <KpiSection sources={sources} />
      </section>

      <section
        aria-labelledby="analytics-charts"
        className="flex flex-col gap-3"
      >
        <h2
          id="analytics-charts"
          className="text-subtitle1 font-bold text-ink-900"
        >
          {t("analytics.section.charts")}
        </h2>
        <ChartsSection
          exceptionStats={sources.exceptions.stats}
          productStats={sources.products.stats}
        />
      </section>

      <section
        aria-labelledby="analytics-more"
        className="rounded-lg bg-surface p-5 shadow-sm"
      >
        <h2
          id="analytics-more"
          className="text-subtitle1 font-bold text-ink-900"
        >
          {t("analytics.more.title")}
        </h2>
        <p className="mt-1 max-w-3xl text-body2 text-ink-600">
          {t("analytics.more.description")}
        </p>
        <Link
          to="/reports"
          className="mt-3 inline-block font-semibold text-primary hover:underline"
        >
          {t("analytics.more.link")}
        </Link>
      </section>
    </div>
  );
}
