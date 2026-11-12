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
}

export interface OrderStore {
  getByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<OrderWithDetails | null>;
  getById(tenantId: string, id: string): Promise<OrderWithDetails | null>;
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
}

export interface VariantLookup {
  getBySku(tenantId: string, sku: string): Promise<{ id: string } | null>;
}

export interface OrderServiceDeps {
  store: OrderStore;
  variants: VariantLookup;
}
