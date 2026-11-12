export interface SkeletonProps {
  className?: string;
}

/** Pulse placeholder block; compose with spacing utilities. */
export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-ink-200 ${className}`} />;
}
