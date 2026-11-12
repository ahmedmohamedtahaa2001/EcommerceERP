import { useT } from "../../lib/i18n";
import { ChartsSection } from "./ChartsSection";
import { KpiSection } from "./KpiSection";
import { RoadmapCard } from "./Roadmap";
import type { KpiSources } from "./hooks";

/**
 * Presentational analytics view (no queries here — see AnalyticsPage).
 * Everything shown is real computed data or an explicitly gold "قريباً"
 * roadmap card; fake charts and fake numbers are forbidden.
 */

const ROADMAP_IDS = [
  "codRate",
  "rtoRate",
  "onTimeDelivery",
  "dockToStock",
  "sellThrough",
] as const;

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
        aria-labelledby="analytics-roadmap"
        className="flex flex-col gap-3"
      >
        <h2
          id="analytics-roadmap"
          className="text-subtitle1 font-bold text-ink-900"
        >
          {t("analytics.roadmap.title")}
        </h2>
        <p className="max-w-3xl text-body2 text-ink-600">
          {t("analytics.roadmap.description")}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ROADMAP_IDS.map((id) => (
            <RoadmapCard
              key={id}
              title={t(`analytics.roadmap.${id}.title`)}
              description={t(`analytics.roadmap.${id}.description`)}
              phase={t("analytics.roadmap.phase")}
              phaseLabel={t("analytics.roadmap.phaseLabel")}
              badge={t("analytics.roadmap.badge")}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
