import { useQueryClient } from "@tanstack/react-query";

import { AnalyticsView } from "./AnalyticsView";
import {
  summarizeExceptions,
  summarizeProducts,
  useLocationsQuery,
  useOpenExceptionsQuery,
  useProductsQuery,
  type KpiSources,
} from "./hooks";

/**
 * Analytics container (route `/analytics`): wires the three real list
 * queries and derives honest aggregates for the view. KPIs without any
 * backend source (COD collection, RTO, on-time delivery, dock-to-stock,
 * sell-through) are NOT computed here — the view renders them as roadmap
 * cards, never as fake numbers.
 */
export function AnalyticsPage() {
  const queryClient = useQueryClient();
  const openExceptions = useOpenExceptionsQuery();
  const products = useProductsQuery();
  const locations = useLocationsQuery();

  const sources: KpiSources = {
    exceptions: {
      state: toLoadState(openExceptions.status),
      onRetry: () =>
        void queryClient.refetchQueries({ queryKey: ["exceptions"] }),
      stats:
        openExceptions.data === undefined
          ? undefined
          : summarizeExceptions(openExceptions.data),
    },
    products: {
      state: toLoadState(products.status),
      onRetry: () =>
        void queryClient.refetchQueries({ queryKey: ["products"] }),
      stats:
        products.data === undefined
          ? undefined
          : summarizeProducts(products.data),
    },
    locations: {
      state: toLoadState(locations.status),
      onRetry: () =>
        void queryClient.refetchQueries({ queryKey: ["locations"] }),
      count: locations.data?.length ?? 0,
    },
  };

  return <AnalyticsView sources={sources} />;
}

function toLoadState(
  status: "pending" | "error" | "success",
): "loading" | "error" | "ready" {
  return status === "pending"
    ? "loading"
    : status === "error"
      ? "error"
      : "ready";
}
