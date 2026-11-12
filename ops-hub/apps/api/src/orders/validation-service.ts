import { transition, type OrderState } from "@ops-hub/domain";
import { normalizePhone } from "@ops-hub/shared";

import { InsufficientStockError } from "../stock/reservation-errors";
import type { ReservationService } from "../stock/reservation-service";
import { OrderNotFoundError } from "./errors";
import type {
  ExceptionStore,
  OrderStore,
  OrderWithDetails,
  VariantLookup,
} from "./types";

export const VALIDATION_RESERVATION_TTL_SECONDS = 15 * 60;

export type ValidationReasonCode =
  | "ADDRESS_INCOMPLETE"
  | "INVALID_PHONE"
  | "PRODUCT_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "PAYMENT_METHOD_NOT_ALLOWED";

export interface ValidationResult {
  status: "validated" | "on_hold";
  reasonCode: ValidationReasonCode | null;
  exceptionId: string | null;
}

const ALLOWED_PAYMENT_METHODS = new Set(["cod", "prepaid"]);

export interface OrderValidationDeps {
  store: OrderStore;
  exceptions: ExceptionStore;
  variants: VariantLookup;
  reservations: ReservationService;
}

/**
 * Runs the checks from the AC in order (address, phone, product existence,
 * stock, payment method) and stops at the first failure — a single
 * `reasonCode` per run, as the AC asks for. Success moves the order to
 * `validated`; any failure moves it to `on_hold` with an exception row
 * recording why.
 */
export class OrderValidationService {
  constructor(private readonly deps: OrderValidationDeps) {}

  async validate(
    tenantId: string,
    orderId: string,
    locationId: string,
    actor: { type: "user" | "api_key"; id: string } | null,
  ): Promise<ValidationResult> {
    const order = await this.deps.store.getById(tenantId, orderId);
    if (!order) {
      throw new OrderNotFoundError();
    }

    const reasonCode = await this.runChecks(tenantId, order, locationId, actor);
    const currentState = order.order.status as OrderState;

    if (!reasonCode) {
      transition(currentState, "validated");
      await this.deps.store.updateStatus(tenantId, orderId, "validated");
      return { status: "validated", reasonCode: null, exceptionId: null };
    }

    transition(currentState, "on_hold");
    await this.deps.store.updateStatus(tenantId, orderId, "on_hold");
    const exception = await this.deps.exceptions.create(
      tenantId,
      orderId,
      reasonCode,
    );
    return { status: "on_hold", reasonCode, exceptionId: exception.id };
  }

  private async runChecks(
    tenantId: string,
    order: OrderWithDetails,
    locationId: string,
    actor: { type: "user" | "api_key"; id: string } | null,
  ): Promise<ValidationReasonCode | null> {
    // 1. Address completeness: a resolvable governorate is required.
    if (!order.address || !order.address.governorateCode) {
      return "ADDRESS_INCOMPLETE";
    }

    // 2. Phone validity (defensive re-check; createOrder already normalizes).
    try {
      normalizePhone(order.customer.phone);
    } catch {
      return "INVALID_PHONE";
    }

    // 3. Every line's product must still exist.
    for (const line of order.lines) {
      const variant = await this.deps.variants.getBySku(tenantId, line.sku);
      if (!variant) {
        return "PRODUCT_NOT_FOUND";
      }
    }

    // 4. Stock must be available — allocate a real reservation per line, so
    // a validated order actually holds its stock. Roll back any
    // reservations made in this same run if a later line can't be filled.
    const madeReservationIds: string[] = [];
    for (const line of order.lines) {
      try {
        const reservation = await this.deps.reservations.reserve(
          {
            variantId: line.variantId,
            locationId,
            quantity: line.quantity,
            ttlSeconds: VALIDATION_RESERVATION_TTL_SECONDS,
          },
          tenantId,
          actor,
        );
        madeReservationIds.push(reservation.id);
      } catch (error) {
        if (error instanceof InsufficientStockError) {
          for (const id of madeReservationIds) {
            await this.deps.reservations.release(tenantId, id, actor);
          }
          return "INSUFFICIENT_STOCK";
        }
        throw error;
      }
    }

    // 5. Payment method must be one this tenant accepts.
    if (!ALLOWED_PAYMENT_METHODS.has(order.payment.method)) {
      return "PAYMENT_METHOD_NOT_ALLOWED";
    }

    return null;
  }
}
