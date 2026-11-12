import type { Customer } from "../../lib/api/orders";

/**
 * STUB — do NOT wire into the page yet.
 *
 * The API has no customers list endpoint today: `GET /v1/orders` itself
 * doesn't exist server-side, and customer records are embedded in order
 * details (`GET /v1/orders/:id` → `customer`). There is nothing honest to
 * query, so this hook is intentionally inert until **P3-S12-T01** ships
 * `GET /v1/customers`.
 *
 * When that lands: replace the body with a `useQuery` call
 * (`queryKey: ["customers", filters]`), add a phone/filter param, and drop
 * it into `CustomersPage` between the search section and the list.
 */
export interface CustomersQueryResult {
  status: "stub";
  customers: readonly Customer[];
}

export function useCustomersQuery(): CustomersQueryResult {
  return { status: "stub", customers: [] };
}
