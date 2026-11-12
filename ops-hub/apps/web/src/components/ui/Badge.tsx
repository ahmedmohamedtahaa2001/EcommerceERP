import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  /** Flat content styling; the badge overlays `children`. */
  className?: string;
  title?: string;
}

/** Small count indicator (notifications, cart-style counters). */
export function Badge({ children, className = "", title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex min-w-5 items-center justify-center rounded-pill bg-alert px-1.5 py-0.5 text-caption font-bold leading-none text-white ${className}`}
    >
      {children}
    </span>
  );
}
