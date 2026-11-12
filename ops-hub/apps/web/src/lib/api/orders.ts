import { apiFetch } from "./client";

/**
 * Wire shapes for `/v1/orders*` and `/v1/exceptions*`, matching
 * `apps/api/src/orders/{types,routes,exception-routes}.ts`. Dates arrive as
 * ISO strings.
 *
 * Deviations from UI_PLAN §8, taken from the real API source:
 * - Exceptions live at `/v1/exceptions` (not `/v1/order-exceptions`).
 * - No `GET /v1/orders` list endpoint exists server-side yet; `listOrders`
 *   is typed per the wrapped `{ orders: [...] }` convention used by every
 *   other list endpoint and will 404 until the API adds the route.
 */

/** Matches `OrderRecord` in apps/api/src/orders/types.ts. */
export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  customerId: string;
  addressId: string | null;
  /** One of the 12 order states (pending → delivered, cancelled, returned). */
  status: string;
  currency: string;
  channel: string;
  externalOrderId: string | null;
  idempotencyKey: string | null;
  idempotencyBodyHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderLine {
  id: string;
  tenantId: string;
  orderId: string;
  variantId: string;
  sku: string;
  quantity: number;
  /** Integer minor units (piastres). */
  unitPriceMinor: number;
  currency: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  orderId: string;
  /** "cod" | "prepaid" (server-side allowlist). */
  method: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  phone: string;
  fullName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  tenantId: string;
  customerId: string;
  line1: string;
  line2: string | null;
  city: string | null;
  governorateCode: string | null;
  rawGovernorate: string | null;
  createdAt: string;
}

/** `GET /v1/orders/:id` → 200. Matches `OrderWithDetails`. */
export interface OrderDetail {
  order: Order;
  lines: OrderLine[];
  payment: Payment;
  customer: Customer;
  address: Address | null;
}

/** Matches `DuplicateChecker` return shape in apps/api/src/orders/types.ts. */
export interface DuplicateMatch {
  duplicateOfOrderId: string;
  exceptionId: string;
  matchType: "external_order_id" | "sku_set";
}

/** Matches `ValidationResult` in apps/api/src/orders/validation-service.ts. */
export interface OrderValidationResult {
  status: "validated" | "on_hold";
  reasonCode:
    | "ADDRESS_INCOMPLETE"
    | "INVALID_PHONE"
    | "PRODUCT_NOT_FOUND"
    | "INSUFFICIENT_STOCK"
    | "PAYMENT_METHOD_NOT_ALLOWED"
    | null;
  exceptionId: string | null;
}

/** Matches `ExceptionRecord` in apps/api/src/orders/types.ts. */
export interface OrderException {
  id: string;
  tenantId: string;
  orderId: string;
  reasonCode: string;
  /** "open" until resolved (server sets "resolved"). */
  status: string;
  metadata: Record<string, unknown> | null;
  ownerId: string | null;
  dueAt: string;
  resolution: string | null;
  overdueNotifiedAt: string | null;
  createdAt: string;
}

export interface OrderLineInput {
  sku: string;
  quantity: number;
  unitPriceMinor: number;
  currency?: string;
}

export interface CreateOrderRequest {
  customer: { phone: string; fullName?: string };
  address: {
    line1: string;
    line2?: string;
    city?: string;
    governorate: string;
  };
  lines: OrderLineInput[];
  payment: { method: "cod" | "prepaid" };
  channel?: string;
  externalOrderId?: string;
}

/** `GET /v1/orders`: filter by status, order number or the customer's phone. */
export function listOrders(params: {
  status?: string | undefined;
  phone?: string | undefined;
  cursor?: string | undefined;
}): Promise<{ orders: Order[]; nextCursor: string | null }> {
  return apiFetch<{ orders: Order[]; nextCursor: string | null }>(
    "/v1/orders",
    {
      searchParams: {
        status: params.status,
        phone: params.phone,
        cursor: params.cursor,
      },
    },
  );
}

/** `GET /v1/orders/:id` → 200. */
export function getOrder(id: string): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(`/v1/orders/${encodeURIComponent(id)}`);
}

/** `POST /v1/orders` → 201 (200 when replaying an idempotency key). */
export function createOrder(
  body: CreateOrderRequest,
  idempotencyKey: string,
): Promise<OrderDetail & { duplicate: DuplicateMatch | null }> {
  return apiFetch<OrderDetail & { duplicate: DuplicateMatch | null }>(
    "/v1/orders",
    {
      method: "POST",
      body,
      extraHeaders: { "idempotency-key": idempotencyKey },
    },
  );
}

/** `POST /v1/orders/:id/validate` → 200. */
export function validateOrder(
  id: string,
  locationId: string,
): Promise<OrderValidationResult> {
  return apiFetch<OrderValidationResult>(
    `/v1/orders/${encodeURIComponent(id)}/validate`,
    { method: "POST", body: { locationId } },
  );
}

/** `GET /v1/exceptions?status&orderId` → 200. */
export function listExceptions(params: {
  status?: string;
  orderId?: string;
}): Promise<{ exceptions: OrderException[] }> {
  return apiFetch<{ exceptions: OrderException[] }>("/v1/exceptions", {
    searchParams: { status: params.status, orderId: params.orderId },
  });
}

/** `GET /v1/exceptions/:id` → 200. */
export function getException(id: string): Promise<OrderException> {
  return apiFetch<OrderException>(`/v1/exceptions/${encodeURIComponent(id)}`);
}

/** `POST /v1/exceptions/:id/assign` → 200. */
export function assignException(
  id: string,
  ownerId: string,
): Promise<OrderException> {
  return apiFetch<OrderException>(
    `/v1/exceptions/${encodeURIComponent(id)}/assign`,
    { method: "POST", body: { ownerId } },
  );
}

/** `POST /v1/exceptions/:id/resolve` → 200 (fails if not open). */
export function resolveException(
  id: string,
  resolution: string,
): Promise<OrderException> {
  return apiFetch<OrderException>(
    `/v1/exceptions/${encodeURIComponent(id)}/resolve`,
    { method: "POST", body: { resolution } },
  );
}

/** `POST /v1/order-exceptions/:id/duplicate-review` → 200. */
export function reviewDuplicate(
  id: string,
  action: "accept" | "merge",
): Promise<{ action: string }> {
  return apiFetch<{ action: string }>(
    `/v1/order-exceptions/${encodeURIComponent(id)}/duplicate-review`,
    { method: "POST", body: { action } },
  );
}
