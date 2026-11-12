import { useQuery } from "@tanstack/react-query";

import { listLocations } from "../../lib/api/inventory";
import { listExceptions, type OrderException } from "../../lib/api/orders";
import { listProducts, type Product } from "../../lib/api/products";

/**
 * Server-state hooks + pure aggregations for the analytics page. Everything
 * computed here comes from real list endpoints (`/v1/exceptions`,
 * `/v1/products`, `/v1/locations`); KPIs without a backend source are NOT
 * fabricated — they render as roadmap cards in the view.
 */

/** Open exceptions only; `dueAt` drives the overdue count. */
export function useOpenExceptionsQuery() {
  return useQuery({
    queryKey: ["exceptions", "open"],
    queryFn: () => listExceptions({ status: "open" }),
    select: (data) => data.exceptions,
    staleTime: 30_000,
  });
}

export function useProductsQuery() {
  return useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
    select: (data) => data.products,
    staleTime: 60_000,
  });
}

export function useLocationsQuery() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: listLocations,
    select: (data) => data.locations,
    staleTime: 60_000,
  });
}

export interface ReasonCount {
  code: string;
  count: number;
}

export interface ExceptionStats {
  open: number;
  /** Open exceptions whose `dueAt` has already passed. */
  overdue: number;
  /** reason_code distribution, most frequent first. */
  reasons: readonly ReasonCount[];
}

/** Pure: open-exception totals + reason_code distribution (real data only). */
export function summarizeExceptions(
  exceptions: readonly OrderException[],
  now: number = Date.now(),
): ExceptionStats {
  const counts = new Map<string, number>();
  let overdue = 0;
  for (const exception of exceptions) {
    if (exception.status !== "open") {
      continue;
    }
    counts.set(
      exception.reasonCode,
      (counts.get(exception.reasonCode) ?? 0) + 1,
    );
    if (new Date(exception.dueAt).getTime() < now) {
      overdue += 1;
    }
  }
  const reasons = Array.from(counts, ([code, count]) => ({ code, count })).sort(
    (a, b) => b.count - a.count || a.code.localeCompare(b.code),
  );
  return { open: exceptions.length, overdue, reasons };
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface ProductStats {
  total: number;
  statuses: readonly StatusCount[];
}

const PRODUCT_STATUS_ORDER = ["active", "draft", "archived"] as const;

/** Pure: product counts per known status (real data only). */
export function summarizeProducts(products: readonly Product[]): ProductStats {
  const counts = new Map<string, number>();
  for (const product of products) {
    counts.set(product.status, (counts.get(product.status) ?? 0) + 1);
  }
  const statuses = PRODUCT_STATUS_ORDER.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
  return { total: products.length, statuses };
}

/** Reason codes that ship with translations (global `reason.*` keys + duplicate). */
const KNOWN_REASON_CODES = new Set([
  "ADDRESS_INCOMPLETE",
  "INVALID_PHONE",
  "PRODUCT_NOT_FOUND",
  "INSUFFICIENT_STOCK",
  "PAYMENT_METHOD_NOT_ALLOWED",
  "DUPLICATE_SUSPECTED",
]);

export function isKnownReasonCode(code: string): boolean {
  return KNOWN_REASON_CODES.has(code);
}

/** Load state of one KPI source, for skeleton/error rendering. */
export interface KpiLoadState {
  state: "loading" | "error" | "ready";
  onRetry: () => void;
}

/** Everything the analytics view needs, already derived. */
export interface KpiSources {
  exceptions: KpiLoadState & { stats: ExceptionStats | undefined };
  products: KpiLoadState & { stats: ProductStats | undefined };
  locations: KpiLoadState & { count: number };
}
