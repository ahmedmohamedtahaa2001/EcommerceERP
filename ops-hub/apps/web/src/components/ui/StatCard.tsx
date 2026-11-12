import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  /** Pre-formatted display value (use lib/format helpers). */
  value: ReactNode;
  hint?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  loading?: boolean;
}

/** KPI tile for the dashboard and list headers. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  loading = false,
}: StatCardProps) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body2 font-semibold text-ink-600">{label}</p>
        {icon !== undefined ? (
          <span className="text-primary" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className="mt-1 text-heading5 font-bold text-ink-900">{value}</p>
      )}
      {hint !== undefined && !loading ? (
        <p className="mt-1 text-caption text-ink-600">{hint}</p>
      ) : null}
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-ink-200 ${className}`} />;
}
