export interface ProgressBarProps {
  /** 0–100. */
  value: number;
  label?: string;
  className?: string;
}

export function ProgressBar({
  value,
  label,
  className = "",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-pill bg-ink-200 ${className}`}
    >
      <div
        className="h-full rounded-pill bg-primary transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
