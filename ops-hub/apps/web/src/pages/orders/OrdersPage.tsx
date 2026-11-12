import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useT } from "../../lib/i18n";
import { listOrders } from "../../lib/api/orders";
import type { OrderListItem } from "../../lib/api/orders";
import { PageHeader, Pagination } from "../../components/ui";
import { OrdersFilters } from "./OrdersFilters";
import { OrdersTable } from "./OrdersTable";

const PAGE_SIZE = 10;

/**
 * Orders list (`/orders`). Reads `GET /v1/orders`; filters and pagination
 * live in URL search params.
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
  });

  const sourceRows: readonly OrderListItem[] = ordersQuery.data?.orders ?? [];

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

      <OrdersFilters
        status={status}
        query={query}
        channel={channel}
        onStatusChange={(value) => setParam("status", value)}
        onQueryChange={(value) => setParam("q", value)}
        onChannelChange={(value) => setParam("channel", value)}
      />

      <p className="text-caption text-ink-600" role="status">
        {t("table.showing", {
          from: rangeStart,
          to: rangeEnd,
          total: filteredRows.length,
        })}
      </p>

      <OrdersTable
        rows={pageRows}
        isLoading={ordersQuery.isLoading}
        isError={ordersQuery.isError}
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
