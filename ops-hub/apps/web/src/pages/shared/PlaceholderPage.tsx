import { useT } from "../../lib/i18n";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/Breadcrumbs";

export interface PlaceholderPageProps {
  titleKey: string;
  descriptionKey?: string;
}

/**
 * Phase-A stand-in used by every routed page: correct title/description
 * from the i18n keys plus a "coming in next phase" empty state. Page agents
 * replace the page file contents; this helper stays untouched.
 */
export function PlaceholderPage({
  titleKey,
  descriptionKey,
}: PlaceholderPageProps) {
  const t = useT();

  return (
    <>
      <PageHeader
        title={t(titleKey)}
        description={
          descriptionKey !== undefined ? t(descriptionKey) : undefined
        }
      />
      <Card className="mt-6">
        <EmptyState
          title={t("state.comingSoon")}
          description={t("state.comingSoonHint")}
        />
      </Card>
    </>
  );
}
