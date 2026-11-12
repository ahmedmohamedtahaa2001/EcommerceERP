export interface RoadmapCardProps {
  title: string;
  description: string;
  /** Phase label, e.g. "P3-S12-T06" (kept ASCII; isolated for bidi). */
  phase: string;
  /** Localized prefix for the phase line, e.g. "تُحتسب مع". */
  phaseLabel: string;
  /** "قريباً" badge text. */
  badge: string;
}

/**
 * Gold "coming soon" card for KPIs that have no real data source yet.
 * Visually distinct from live StatCards (secondary surface + badge) so a
 * roadmap promise can never be mistaken for a real number.
 */
export function RoadmapCard({
  title,
  description,
  phase,
  phaseLabel,
  badge,
}: RoadmapCardProps) {
  return (
    <div className="rounded-lg border border-secondary-light bg-secondary-lightest p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-body2 font-semibold text-ink-900">{title}</p>
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
          {badge}
        </span>
      </div>
      <p className="mt-2 text-caption leading-relaxed text-ink-700">
        {description}
      </p>
      <p className="mt-3 text-caption font-semibold text-secondary-darkest">
        {phaseLabel} <bdi>{phase}</bdi>
      </p>
    </div>
  );
}
