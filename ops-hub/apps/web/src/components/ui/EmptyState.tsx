import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  className?: string;
}

/** Guidance-first empty state; never a blank screen. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-2 px-6 py-16 text-center ${className}`}
    >
      <div
        className="mb-2 flex h-12 w-12 items-center justify-center rounded-pill bg-ink-100 text-ink-400"
        aria-hidden="true"
      >
        {icon ?? (
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
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
          </svg>
        )}
      </div>
      <h3 className="text-subtitle2 font-bold text-ink-900">{title}</h3>
      {description !== undefined ? (
        <p className="max-w-sm text-body2 text-ink-600">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
