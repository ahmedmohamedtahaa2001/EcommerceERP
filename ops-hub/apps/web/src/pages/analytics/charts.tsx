import { Card } from "../../components/ui";
import { formatNumber } from "../../lib/format";

/** Bar fill colors — Flora status tokens only (never color alone: labels + counts are text). */
const TONE_BAR_CLASS = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  alert: "bg-alert",
} as const;

export type BarTone = keyof typeof TONE_BAR_CLASS;

export interface BarItem {
  id: string;
  label: string;
  count: number;
  tone: BarTone;
}

export interface BarDistributionProps {
  title: string;
  items: readonly BarItem[];
  /** Full accessible chart description for `role="img"`. */
  ariaLabel: string;
  /** Visible one-line text summary under the bars. */
  summary: string;
  emptyText: string;
}

/**
 * RTL-safe horizontal bar chart in pure CSS — no chart library. Bars grow
 * from inline-start (flex/block start follows document direction), counts
 * are real text, and the whole figure is exposed as a single `role="img"`
 * with an aria-label plus a visible text summary for screen readers and
 * small screens alike.
 */
export function BarDistribution({
  title,
  items,
  ariaLabel,
  summary,
  emptyText,
}: BarDistributionProps) {
  const visible = items.filter((item) => item.count > 0);
  const max = Math.max(...visible.map((item) => item.count), 1);

  return (
    <Card className="p-4" role="group">
      <h2 className="text-subtitle2 font-bold text-ink-900">{title}</h2>
      {visible.length === 0 ? (
        <p role="status" className="py-8 text-center text-body2 text-ink-600">
          {emptyText}
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={ariaLabel}
            className="mt-4 flex flex-col gap-3"
          >
            {visible.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-body2 text-ink-700">
                  <bdi>{item.label}</bdi>
                </span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-pill bg-ink-100"
                  aria-hidden="true"
                >
                  <div
                    className={`h-full rounded-pill ${TONE_BAR_CLASS[item.tone]}`}
                    style={{
                      width: `${Math.max(Math.round((item.count / max) * 100), 8)}%`,
                    }}
                  />
                </div>
                <span className="w-12 shrink-0 text-end text-body2 font-semibold text-ink-900 tabular-nums">
                  {formatNumber(item.count)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-caption text-ink-600">{summary}</p>
        </>
      )}
    </Card>
  );
}
