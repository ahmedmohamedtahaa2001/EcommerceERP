import { Link, useNavigate } from "react-router-dom";
import type { KeyboardEvent, ReactNode } from "react";

import { useT } from "../../lib/i18n";
import { formatMoney, formatRelative } from "../../lib/format";
import {
  EmptyState,
  ErrorState,
  Skeleton,
  StatusPill,
  Table,
  TD,
  TH,
  THead,
  Tag,
} from "../../components/ui";
import type { OrderListRow } from "./demoOrders";

export interface OrdersTableProps {
  rows: readonly OrderListRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  footer?: ReactNode;
}

const SKELETON_ROWS = 8;
const COLUMN_HEADERS = [
  "orders.columns.orderNumber",
  "orders.columns.customer",
  "orders.columns.governorate",
  "orders.columns.items",
  "orders.columns.total",
  "orders.columns.payment",
  "orders.columns.status",
  "orders.columns.created",
] as const;

/** Missing (real-data) cells render as a muted dash — never a fake value. */
function Cell({ value }: { value: string | undefined }) {
  if (value === undefined || value === "") {
    return <span className="text-ink-400">—</span>;
  }
  return <>{value}</>;
}

function Missing() {
  return <span className="text-ink-400">—</span>;
}

/** Clickable, keyboard-activatable row (Enter/Space) with zebra + focus ring. */
function Row({
  children,
  onActivate,
}: {
  children: ReactNode;
  onActivate: () => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };
  return (
    <tr
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      className="cursor-pointer border-b border-ink-200 transition-colors odd:bg-ink-100/60 hover:bg-ink-100/80 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
    >
      {children}
    </tr>
  );
}

function PaymentCell({ method }: { method: string | undefined }) {
  const t = useT();
  if (method === undefined || method === "") {
    return <Missing />;
  }
  if (method === "cod" || method === "prepaid") {
    return (
      <Tag tone={method === "cod" ? "info" : "secondary"}>
        {t(`orders.payment.${method}`)}
      </Tag>
    );
  }
  return <Tag tone="neutral">{method}</Tag>;
}

/**
 * Orders list table. Rows navigate to the detail page on click and via
 * keyboard (Enter/Space); the order-number cell carries a real link for
 * screen-reader and modifier-click semantics.
 */
export function OrdersTable({
  rows,
  isLoading,
  isError,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  footer,
}: OrdersTableProps) {
  const t = useT();
  const navigate = useNavigate();

  const openDetail = (row: OrderListRow): void => {
    void navigate(`/orders/${encodeURIComponent(row.id)}`);
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="rounded-lg bg-surface shadow-sm"
      >
        <Table ariaLabel={t("orders.title")}>
          <THead>
            <tr>
              {COLUMN_HEADERS.map((key) => (
                <TH key={key}>{t(key)}</TH>
              ))}
            </tr>
          </THead>
          <tbody>
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <tr key={index} className="border-b border-ink-200">
                {COLUMN_HEADERS.map((key) => (
                  <TD key={key}>
                    <Skeleton className="h-4 w-full min-w-16" />
                  </TD>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        error={error}
        onRetry={onRetry}
        className="rounded-lg bg-surface shadow-sm"
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className="rounded-lg bg-surface shadow-sm"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg bg-surface shadow-sm">
        <Table ariaLabel={t("orders.title")}>
          <THead>
            <tr>
              {COLUMN_HEADERS.map((key) => (
                <TH key={key}>{t(key)}</TH>
              ))}
            </tr>
          </THead>
          <tbody>
            {rows.map((row) => (
              <Row key={row.id} onActivate={() => openDetail(row)}>
                <TD>
                  <Link
                    to={`/orders/${encodeURIComponent(row.id)}`}
                    className="font-mono font-semibold text-info hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {row.orderNumber}
                  </Link>
                </TD>
                <TD>
                  <div className="flex flex-col gap-0.5">
                    <Cell value={row.customerName} />
                    <span
                      className="font-mono text-caption text-ink-500"
                      dir="ltr"
                    >
                      <Cell value={row.customerPhone} />
                    </span>
                  </div>
                </TD>
                <TD>
                  <Cell value={row.governorate} />
                </TD>
                <TD>
                  {row.itemsCount === undefined ? (
                    <Missing />
                  ) : (
                    t("orders.itemsCount", { count: row.itemsCount })
                  )}
                </TD>
                <TD>
                  {row.totalMinor === undefined ? (
                    <Missing />
                  ) : (
                    formatMoney(row.totalMinor, row.currency)
                  )}
                </TD>
                <TD>
                  <PaymentCell method={row.method} />
                </TD>
                <TD>
                  <StatusPill kind={{ type: "order", status: row.status }} />
                </TD>
                <TD className="whitespace-nowrap text-ink-500">
                  <time dateTime={row.createdAt}>
                    {formatRelative(row.createdAt)}
                  </time>
                </TD>
              </Row>
            ))}
          </tbody>
        </Table>
      </div>
      {footer}
    </div>
  );
}
