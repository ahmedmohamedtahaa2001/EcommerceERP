import { describeProblem } from "../../lib/api/problem-message";
import { useLocale, useT } from "../../lib/i18n";
import { Button } from "./Button";

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

/**
 * A generic heading, plus the problem in the reader's language when the
 * server sent a known code. Retry re-runs the failed query.
 */
export function ErrorState({
  error,
  onRetry,
  className = "",
}: ErrorStateProps) {
  const t = useT();
  const { locale } = useLocale();
  const title = t("state.error");
  const detail = describeProblem(error, t, locale);

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-2 px-6 py-12 text-center ${className}`}
    >
      <div
        className="mb-2 flex h-12 w-12 items-center justify-center rounded-pill bg-alert-light text-alert"
        aria-hidden="true"
      >
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
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>
      <h3 className="text-subtitle2 font-bold text-ink-900">{title}</h3>
      {detail !== undefined ? (
        <p className="max-w-md text-body2 text-ink-600">{detail}</p>
      ) : null}
      {onRetry !== undefined ? (
        <Button variant="outlined" size="sm" className="mt-3" onClick={onRetry}>
          {t("action.retry")}
        </Button>
      ) : null}
    </div>
  );
}
