import { Card, EmptyState, PageHeader, SearchBar } from "../../components/ui";
import { useT } from "../../lib/i18n";

/**
 * Presentational customers view (state comes from CustomersPage).
 * Search-first + honest empty state + gold roadmap card; no fabricated
 * customer rows.
 */

export interface CustomersViewProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
  submittedPhone: string;
}

export function CustomersView({
  inputValue,
  onInputChange,
  onSubmit,
  submittedPhone,
}: CustomersViewProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("customers.title")}
        description={t("customers.description")}
      />

      <section
        aria-labelledby="customers-search"
        className="flex flex-col gap-3"
      >
        <h2
          id="customers-search"
          className="text-subtitle1 font-bold text-ink-900"
        >
          {t("customers.search.sectionTitle")}
        </h2>
        <Card className="max-w-xl p-4">
          <SearchBar
            value={inputValue}
            onChange={onInputChange}
            onSubmit={onSubmit}
            placeholder={t("customers.search.placeholder")}
            label={t("customers.search.label")}
            className="max-w-md"
          />
          <p className="mt-2 text-caption text-ink-600">
            {t("customers.search.hint")}
          </p>
        </Card>
        {submittedPhone === "" ? null : (
          <SearchInfoCard phone={submittedPhone} />
        )}
      </section>

      <Card>
        <EmptyState
          title={t("customers.empty.title")}
          description={t("customers.empty.description")}
          icon={<UserIcon />}
        />
      </Card>

      <section
        aria-labelledby="customers-roadmap"
        className="flex flex-col gap-3"
      >
        <h2
          id="customers-roadmap"
          className="text-subtitle1 font-bold text-ink-900"
        >
          {t("customers.roadmap.title")}
        </h2>
        <RoadmapCard />
      </section>
    </div>
  );
}

/** Designed informational result: direct lookup isn't live yet — never fake results. */
function SearchInfoCard({ phone }: { phone: string }) {
  const t = useT();
  return (
    <div
      role="status"
      className="flex max-w-xl items-start gap-3 rounded-lg border border-info bg-info-light p-4"
    >
      <span className="mt-0.5 shrink-0 text-info" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </span>
      <div>
        <p className="text-body2 font-semibold text-ink-900">
          {t("customers.search.infoTitle")}
        </p>
        <p className="mt-1 text-caption text-ink-700">
          {t("customers.search.infoBody")}
        </p>
        <p className="mt-1 text-caption text-ink-700">
          {t("customers.search.phoneLabel")}{" "}
          <bdi dir="ltr" className="font-semibold">
            {phone}
          </bdi>
        </p>
      </div>
    </div>
  );
}

/** Gold "coming soon" card — visually distinct from real data. */
function RoadmapCard() {
  const t = useT();
  return (
    <div className="max-w-xl rounded-lg border border-secondary-light bg-secondary-lightest p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-body2 font-semibold text-ink-900">
          {t("customers.roadmap.title")}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-secondary-darkest px-2 py-0.5 text-caption font-bold text-white">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          {t("customers.roadmap.badge")}
        </span>
      </div>
      <p className="mt-2 text-caption leading-relaxed text-ink-700">
        {t("customers.roadmap.body")}
      </p>
      <p className="mt-3 text-caption font-semibold text-secondary-darkest">
        {t("customers.roadmap.phaseLabel")}{" "}
        <bdi>{t("customers.roadmap.phase")}</bdi>
      </p>
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
