import { apiFetch } from "./client";

export type BulkOutcome = "ok" | "skipped" | "not-found";

export interface BulkItemResult {
  id: string;
  outcome: BulkOutcome;
  changed: number;
  reason?: string;
}

export interface BulkResult {
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
  items: BulkItemResult[];
}

/** `POST /v1/bulk/products/status` → 200: one result per product. */
export function setProductsStatus(
  ids: string[],
  status: string,
): Promise<BulkResult> {
  return apiFetch<BulkResult>("/v1/bulk/products/status", {
    method: "POST",
    body: { ids, status },
  });
}

/** `POST /v1/bulk/products/prices` → 200: one result per product. Values are minor units for `set`. */
export function changeProductsPrices(
  productIds: string[],
  change: { mode: "percent" | "set"; value: number },
): Promise<BulkResult> {
  return apiFetch<BulkResult>("/v1/bulk/products/prices", {
    method: "POST",
    body: { productIds, ...change },
  });
}
