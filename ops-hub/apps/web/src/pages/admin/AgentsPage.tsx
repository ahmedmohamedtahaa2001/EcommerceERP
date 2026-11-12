import { PageHeader } from "../../components/ui/Breadcrumbs";
import { Card } from "../../components/ui/Card";
import { Tag } from "../../components/ui/Tag";
import { useT } from "../../lib/i18n";

const AGENT_IDS = ["restock", "exceptions", "cod", "priorities"] as const;

/**
 * Automation agents catalog (FEATURES.md module 12). Phase 3–4 work
 * (P3-S12 / P4-S14): today this is a designed, honest roadmap surface —
 * no toggles that pretend to run anything.
 */
export function AgentsPage() {
  const t = useT();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.agents")}
        description={t("agents.description")}
      />
      <p className="max-w-3xl text-body2 text-ink-600">
        {t("agents.phaseNote")}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {AGENT_IDS.map((id) => (
          <Card key={id} className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-subtitle1 font-bold text-ink-900">
                {t(`agents.card.${id}.title`)}
              </h3>
              <Tag tone="secondary">{t("agents.statusBadge")}</Tag>
            </div>
            <p className="text-body2 text-ink-600">
              {t(`agents.card.${id}.desc`)}
            </p>
            <button
              type="button"
              disabled
              className="mt-auto self-start text-caption font-semibold text-ink-400"
              title={t("agents.ctaDisabled")}
            >
              {t("agents.cta")}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
