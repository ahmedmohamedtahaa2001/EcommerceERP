import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useT } from "../../lib/i18n";
import { ApiError } from "../../lib/api/client";
import { listOrders } from "../../lib/api/orders";
import { Button, PageHeader, Pagination } from "../../components/ui";
import { OrdersFilters } from "./OrdersFilters";
import { OrdersTable } from "./OrdersTable";
import { buildDemoOrders, type OrderListRow } from "./demoOrders";

const PAGE_SIZE = 10;

/**
 * Orders list (`/orders`, UI_PLAN §7). `GET /v1/orders` doesn't exist
 * server-side yet (P1-S3-T07): a 404 ApiError switches the page into a
 * clearly-labeled design-preview mode with realistic demo data, while the
 * real-data path stays wired and works unchanged once the route ships.
 * Filters and pagination live in URL search params.
 */
export function OrdersPage() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const query = searchParams.get("q") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const requestedPage = Math.max(
    1,
    Number(searchParams.get("page") ?? "1") || 1,
  );

  const setParam = (key: string, value: string): void => {
    const next = new URLSearchParams(searchParams);
    if (value === "" || (key === "page" && value === "1")) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    if (key !== "page") {
      next.delete("page");
    }
    setSearchParams(next, { replace: true });
  };

  const ordersQuery = useQuery({
    queryKey: ["orders", "list", status],
    queryFn: () => listOrders(status === "" ? {} : { status }),
    // A 404 means "route not shipped yet" — no point retrying it.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404
        ? false
        : failureCount < 2,
  });

  const isPreview =
    ordersQuery.error instanceof ApiError && ordersQuery.error.status === 404;
  const demoRows = useMemo(() => buildDemoOrders(), []);
  const sourceRows: readonly OrderListRow[] = isPreview
    ? demoRows
    : (ordersQuery.data?.orders ?? []);

  const trimmedQuery = query.trim().toLowerCase();
  const filteredRows = sourceRows.filter((row) => {
    const matchesQuery =
      trimmedQuery === "" ||
      row.orderNumber.toLowerCase().includes(trimmedQuery) ||
      (row.customerPhone ?? "").includes(trimmedQuery);
    const matchesChannel = channel === "" || row.channel === channel;
    return matchesQuery && matchesChannel;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredRows.length);
  const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("orders.title")}
        description={t("orders.description")}
      />

      {isPreview ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded border border-warning bg-warning-light px-3 py-2"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-warning"
            aria-hidden="true"
          >
            <path d="m10.3 3.9-8.5 14.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <p className="min-w-0 flex-1 text-body2 font-semibold text-ink-800">
            {t("orders.preview.banner")}
          </p>
          <Button
            variant="outlined"
            size="sm"
            onClick={() => void ordersQuery.refetch()}
          >
            {t("action.retry")}
          </Button>
        </div>
      ) : null}

      <OrdersFilters
        status={status}
        query={query}
        channel={channel}
        onStatusChange={(value) => setParam("status", value)}
        onQueryChange={(value) => setParam("q", value)}
        onChannelChange={(value) => setParam("channel", value)}
      />

      <p className="text-caption text-ink-600" role="status">
        {isPreview ? `${t("orders.preview.note")} ` : ""}
        {t("table.showing", {
          from: rangeStart,
          to: rangeEnd,
          total: filteredRows.length,
        })}
      </p>

      <OrdersTable
        rows={pageRows}
        isLoading={ordersQuery.isLoading}
        isError={ordersQuery.isError && !isPreview}
        error={ordersQuery.error}
        onRetry={() => void ordersQuery.refetch()}
        emptyTitle={t("orders.empty.title")}
        emptyDescription={t("orders.empty.hint")}
        footer={
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(next) => setParam("page", String(next))}
            className="justify-center"
          />
        }
      />
    </div>
  );
}
