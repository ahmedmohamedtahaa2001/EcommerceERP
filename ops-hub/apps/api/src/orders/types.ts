import type { CreateOrderRequest } from "@ops-hub/contracts";

export interface CustomerRecord {
  id: string;
  tenantId: string;
  phone: string;
  fullName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddressRecord {
  id: string;
  tenantId: string;
  customerId: string;
  line1: string;
  line2: string | null;
  city: string | null;
  governorateCode: string | null;
  rawGovernorate: string | null;
  createdAt: Date;
}

export interface OrderLineRecord {
  id: string;
  tenantId: string;
  orderId: string;
  variantId: string;
  sku: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
}

export interface PaymentRecord {
  id: string;
  tenantId: string;
  orderId: string;
  method: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderRecord {
  id: string;
  tenantId: string;
  orderNumber: string;
  customerId: string;
  addressId: string | null;
  status: string;
  currency: string;
  channel: string;
  externalOrderId: string | null;
  idempotencyKey: string | null;
  idempotencyBodyHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderWithDetails {
  order: OrderRecord;
  lines: OrderLineRecord[];
  payment: PaymentRecord;
  customer: CustomerRecord;
  address: AddressRecord | null;
}

export interface OrderStore {
  getByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<OrderWithDetails | null>;
  getById(tenantId: string, id: string): Promise<OrderWithDetails | null>;
  /** Lists orders, newest first. Filters are all optional and combine with
   * AND. `limit` is capped by the caller. */
  list(
    tenantId: string,
    filter: {
      status?: string;
      /** Normalized E.164 phone, or null to match nothing. */
      phone?: string | null;
      orderNumber?: string;
      limit: number;
      cursor: { createdAt: string; id: string } | null;
    },
  ): Promise<OrderRecord[]>;
  /** Everything below runs in one transaction: customer upsert, address
   * insert, order number allocation, order + lines + payment insert. */
  createOrder(
    tenantId: string,
    request: CreateOrderRequest,
    idempotencyKey: string,
    idempotencyBodyHash: string,
    resolvedVariants: ReadonlyMap<string, { variantId: string }>,
    governorateCode: string | null,
  ): Promise<OrderWithDetails>;
  /** Also appends an `order_events` row (status_changed) in the SAME
   * transaction as the status update. */
  updateStatus(
    tenantId: string,
    orderId: string,
    status: string,
    actor?: { type: "user" | "api_key"; id: string } | null,
    note?: string,
  ): Promise<void>;
  /** Other non-cancelled orders for this customer, created within the
   * window, excluding `excludeOrderId`, with their SKU sets — candidates
   * for the "same SKU set" duplicate check. */
  findRecentOrdersForCustomer(
    tenantId: string,
    customerId: string,
    excludeOrderId: string,
    createdAfter: Date,
  ): Promise<{ id: string; orderNumber: string; skus: string[] }[]>;
  findByExternalOrderId(
    tenantId: string,
    channel: string,
    externalOrderId: string,
    excludeOrderId: string,
  ): Promise<{ id: string; orderNumber: string } | null>;
}

export interface ExceptionRecord {
  id: string;
  tenantId: string;
  orderId: string;
  reasonCode: string;
  status: string;
  metadata: Record<string, unknown> | null;
  ownerId: string | null;
  dueAt: Date;
  resolution: string | null;
  overdueNotifiedAt: Date | null;
  createdAt: Date;
}

export interface ExceptionStore {
  create(
    tenantId: string,
    orderId: string,
    reasonCode: string,
    dueAt: Date,
    metadata?: Record<string, unknown>,
  ): Promise<ExceptionRecord>;
  getById(tenantId: string, id: string): Promise<ExceptionRecord | null>;
  list(
    tenantId: string,
    filter: {
      status?: string;
      orderId?: string;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<ExceptionRecord[]>;
  assign(
    tenantId: string,
    id: string,
    ownerId: string,
  ): Promise<ExceptionRecord | null>;
  /** No-op (returns false) if the exception isn't `open`. */
  resolve(tenantId: string, id: string, resolution: string): Promise<boolean>;
  /** Open exceptions past due and not yet notified; marks them notified in
   * the same call so a re-run of the sweep never double-counts them. */
  claimOverdue(tenantId: string, asOf: Date): Promise<ExceptionRecord[]>;
}

export interface VariantLookup {
  getBySku(tenantId: string, sku: string): Promise<{ id: string } | null>;
}

export interface DuplicateChecker {
  checkAndFlag(
    tenantId: string,
    order: OrderWithDetails,
  ): Promise<{
    duplicateOfOrderId: string;
    exceptionId: string;
    matchType: "external_order_id" | "sku_set";
  } | null>;
}

export interface OrderServiceDeps {
  store: OrderStore;
  variants: VariantLookup;
  duplicateDetection?: DuplicateChecker;
  events?: OrderEventStore;
}

export interface OrderEventRecord {
  id: string;
  tenantId: string;
  orderId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  customerVisible: boolean;
  actorType: string | null;
  actorId: string | null;
  createdAt: Date;
}

export interface OrderEventStore {
  list(
    tenantId: string,
    orderId: string,
    filter: { customerVisible?: boolean },
  ): Promise<OrderEventRecord[]>;
  addNote(
    tenantId: string,
    orderId: string,
    note: string,
    customerVisible: boolean,
    actor: { type: "user" | "api_key"; id: string } | null,
  ): Promise<OrderEventRecord>;
}
