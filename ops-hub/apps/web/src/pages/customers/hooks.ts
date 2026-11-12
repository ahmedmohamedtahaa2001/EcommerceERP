import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getCustomer, listCustomers } from "../../lib/api/customers";
import { listOrders } from "../../lib/api/orders";

export function useCustomersQuery(q: string) {
  return useInfiniteQuery({
    queryKey: ["customers", q],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listCustomers({ q: q || undefined, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useCustomerQuery(id: string) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id),
    enabled: id !== "",
  });
}

/** Order history is keyed by phone: the orders API filters on it, not on customer id. */
export function useCustomerOrdersQuery(phone: string | undefined) {
  return useQuery({
    queryKey: ["customer-orders", phone],
    queryFn: () => listOrders({ phone }),
    enabled: phone !== undefined && phone !== "",
  });
}
