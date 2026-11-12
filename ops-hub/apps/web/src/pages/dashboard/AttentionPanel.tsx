import { Link } from "react-router-dom";

import { useT } from "../../lib/i18n";
import { formatRelative } from "../../lib/format";
import type { OrderException } from "../../lib/api/orders";
import {
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Tag,
} from "../../components/ui";

export interface AttentionPanelProps {
  exceptions: OrderException[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

const OVERDUE_ICON = (
  <svg
    width="14"
    height="14"
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
);

/** Local reason labels: known codes via i18n, unknown codes shown raw. */
export function reasonLabel(code: string, t: (key: string) => string): string {
  const key = `reason.${code}`;
  const label = t(key);
  return label === key ? code : label;
}

function ExceptionRow({ exception }: { exception: OrderException }) {
  const t = useT();
  const overdue = new Date(exception.dueAt).getTime() < Date.now();

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1">
        <Tag
          tone={
            exception.reasonCode === "DUPLICATE_SUSPECTED"
              ? "secondary"
              : "warning"
          }
        >
          {reasonLabel(exception.reasonCode, t)}
        </Tag>
        <Link
          to={`/orders/${encodeURIComponent(exception.orderId)}`}
          className="truncate font-mono text-body2 text-info hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={t("dashboard.viewOrder")}
        >
          {exception.orderId}
        </Link>
      </div>
      <div
        className={`flex items-center gap-1.5 text-caption ${
          overdue ? "font-semibold text-warning" : "text-ink-500"
        }`}
      >
        {overdue ? OVERDUE_ICON : null}
        <span>{t("dashboard.attention.dueLabel")}:</span>
        <time dateTime={exception.dueAt}>
          {formatRelative(exception.dueAt)}
        </time>
        {overdue ? (
          <Tag tone="warning" className="ms-1">
            {t("dashboard.attention.overdue")}
          </Tag>
        ) : null}
      </div>
    </li>
  );
}

/** Dashboard panel: the open exceptions that need an ops decision, newest due first. */
export function AttentionPanel({
  exceptions,
  isLoading,
  isError,
  error,
  onRetry,
}: AttentionPanelProps) {
  const t = useT();

  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-subtitle2 font-bold text-ink-900">
            {t("dashboard.attention.title")}
          </h2>
          <p className="text-caption text-ink-600">
            {t("dashboard.attention.description")}
          </p>
        </div>
        <Link
          to="/exceptions"
          className="text-body2 font-semibold text-info hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t("dashboard.attention.viewAll")}
        </Link>
      </div>

      {isLoading ? (
        <div
          role="status"
          aria-busy="true"
          className="flex flex-col gap-2 py-2"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : exceptions !== undefined && exceptions.length === 0 ? (
        <EmptyState
          title={t("dashboard.attention.empty.title")}
          description={t("dashboard.attention.empty.hint")}
          className="py-8"
        />
      ) : (
        <ul role="list" className="flex flex-col">
          {(exceptions ?? []).slice(0, 5).map((exception) => (
            <ExceptionRow key={exception.id} exception={exception} />
          ))}
        </ul>
      )}
    </Card>
  );
}
