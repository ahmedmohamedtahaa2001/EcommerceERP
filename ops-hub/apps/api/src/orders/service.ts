import { resolveGovernorate } from "@ops-hub/domain";
import {
  createOrderRequestSchema,
  type CreateOrderRequest,
} from "@ops-hub/contracts";
import { normalizePhone } from "@ops-hub/shared";

import {
  IdempotencyConflictError,
  IdempotencyKeyRequiredError,
  OrderNotFoundError,
  OrderValidationError,
  UnknownSkuError,
} from "./errors";
import { hashRequestBody } from "./idempotency-hash";
import type { OrderServiceDeps, OrderWithDetails } from "./types";

export class OrderService {
  constructor(private readonly deps: OrderServiceDeps) {}

  /** Returns the order and whether this call actually created it (`true`)
   * or returned an existing one from a replayed Idempotency-Key (`false`). */
  async createOrder(
    tenantId: string,
    idempotencyKey: string | undefined,
    rawBody: unknown,
  ): Promise<{ result: OrderWithDetails; created: boolean }> {
    if (!idempotencyKey || idempotencyKey.trim() === "") {
      throw new IdempotencyKeyRequiredError();
    }

    const parsed = createOrderRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new OrderValidationError(
        parsed.error.issues
          .map(
            (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
          )
          .join("; "),
      );
    }
    const request: CreateOrderRequest = parsed.data;
    const bodyHash = hashRequestBody(request);

    const existing = await this.deps.store.getByIdempotencyKey(
      tenantId,
      idempotencyKey,
    );
    if (existing) {
      if (existing.order.idempotencyBodyHash !== bodyHash) {
        throw new IdempotencyConflictError();
      }
      return { result: existing, created: false };
    }

    // normalizePhone throws InvalidPhoneError for a malformed number; let
    // it propagate — it's a DomainError the app's error handler already
    // maps to a sensible status via its own statusCode-less path... but it
    // has no statusCode, so wrap it as a validation error instead.
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhone(request.customer.phone);
    } catch {
      throw new OrderValidationError(
        `customer.phone is not a valid Egyptian mobile number: ${request.customer.phone}`,
      );
    }

    const resolvedVariants = new Map<string, { variantId: string }>();
    for (const line of request.lines) {
      if (resolvedVariants.has(line.sku)) {
        continue;
      }
      const variant = await this.deps.variants.getBySku(tenantId, line.sku);
      if (!variant) {
        throw new UnknownSkuError(line.sku);
      }
      resolvedVariants.set(line.sku, { variantId: variant.id });
    }

    const governorateCode = resolveGovernorate(request.address.governorate);

    const created = await this.deps.store.createOrder(
      tenantId,
      { ...request, customer: { ...request.customer, phone: normalizedPhone } },
      idempotencyKey,
      bodyHash,
      resolvedVariants,
      governorateCode,
    );

    return { result: created, created: true };
  }

  async getById(tenantId: string, id: string): Promise<OrderWithDetails> {
    const order = await this.deps.store.getById(tenantId, id);
    if (!order) {
      throw new OrderNotFoundError();
    }
    return order;
  }
}
