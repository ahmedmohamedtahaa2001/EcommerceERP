import { apiFetch } from "./client";
import type { Address } from "./orders";

/** Matches `CustomerRecord` in apps/api/src/customers/types.ts. */
export interface CustomerRecord {
  id: string;
  tenantId: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail {
  customer: CustomerRecord;
  addresses: Address[];
}

export interface CreateCustomerRequest {
  phone: string;
  fullName?: string | null;
  email?: string | null;
}

export interface UpdateCustomerRequest {
  phone?: string;
  fullName?: string | null;
  email?: string | null;
}

/** `GET /v1/customers`: searched by name, email or phone; keyset-paged. */
export function listCustomers(params: {
  q?: string | undefined;
  cursor?: string | undefined;
}): Promise<{ customers: CustomerRecord[]; nextCursor: string | null }> {
  return apiFetch("/v1/customers", {
    searchParams: { q: params.q, cursor: params.cursor },
  });
}

export function getCustomer(id: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/v1/customers/${encodeURIComponent(id)}`);
}

export function createCustomer(
  body: CreateCustomerRequest,
): Promise<CustomerRecord> {
  return apiFetch<CustomerRecord>("/v1/customers", { method: "POST", body });
}

export function updateCustomer(
  id: string,
  body: UpdateCustomerRequest,
): Promise<CustomerRecord> {
  return apiFetch<CustomerRecord>(`/v1/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}
