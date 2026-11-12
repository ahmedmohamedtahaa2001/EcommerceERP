import type { ReactNode } from "react";

export interface TimelineItem {
  id: string;
  title: string;
  timestamp: string;
  note?: string | null | undefined;
  /** Optional trailing pill/metadata line. */
  meta?: ReactNode | undefined;
}

/** Vertical event timeline for order events and exception history. */
export function Timeline({ items }: { items: readonly TimelineItem[] }) {
  return (
    <ol role="list" className="flex flex-col gap-0">
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-6 last:pb-0">
          {index < items.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute top-4 start-[7px] h-full w-0.5 bg-ink-200"
            />
          ) : null}
          <span
            aria-hidden="true"
            className="relative z-10 mt-1.5 h-4 w-4 shrink-0 rounded-full border-2 border-primary bg-surface"
          />
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body2 font-bold text-ink-900">
                {item.title}
              </span>
              {item.meta}
            </div>
            <time className="text-caption text-ink-500">{item.timestamp}</time>
            {item.note !== undefined && item.note !== null ? (
              <p className="text-body2 text-ink-700">{item.note}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
