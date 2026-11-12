import type { ReactNode } from "react";

export type TagTone =
  | "neutral"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "alert"
  | "info";

export interface TagProps {
  children: ReactNode;
  tone?: TagTone;
  className?: string;
  /** Native tooltip (e.g. full scope list or IP list). */
  title?: string;
}

const TONE_CLASSES: Record<TagTone, string> = {
  neutral: "bg-ink-100 text-ink-700",
  primary: "bg-primary-lightest text-primary-dark",
  secondary: "bg-secondary-lightest text-secondary-darkest",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  alert: "bg-alert-light text-alert",
  info: "bg-info-light text-info",
};

/** Categorical chip (promotion, channel, kind). Compact 4px radius. */
export function Tag({
  children,
  tone = "neutral",
  className = "",
  title,
}: TagProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-semibold ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
