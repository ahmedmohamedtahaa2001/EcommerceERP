import { formatMinorAsMajor, parseMajorToMinor } from "../../lib/money";
import type { CreateOrderRequest } from "../../lib/api/orders";

export interface DraftLine {
  sku: string;
  productName: string;
  quantity: string;
  /** Major units as typed, e.g. "149.50". Converted to minor units on submit. */
  unitPrice: string;
  currency: string;
}

export interface OrderDraft {
  phone: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  governorate: string;
  paymentMethod: "cod" | "prepaid";
  channel: string;
  externalOrderId: string;
  lines: DraftLine[];
}

export type LineErrors = {
  quantity?: "invalid";
  unitPrice?: "required" | "invalid";
};

export interface DraftErrors {
  phone?: "required";
  line1?: "required";
  governorate?: "required";
  lines?: "empty" | LineErrors[];
}

export function emptyDraft(): OrderDraft {
  return {
    phone: "",
    fullName: "",
    line1: "",
    line2: "",
    city: "",
    governorate: "",
    paymentMethod: "cod",
    channel: "manual",
    externalOrderId: "",
    lines: [],
  };
}

const WHOLE_NUMBER = /^\d+$/;

export function parseQuantity(input: string): number | null {
  const trimmed = input.trim();
  if (!WHOLE_NUMBER.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

function parsePrice(input: string): number | null {
  try {
    return parseMajorToMinor(input);
  } catch {
    return null;
  }
}

/** Field-level checks shown in the form. The API stays authoritative. */
export function validateOrderDraft(draft: OrderDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.phone.trim() === "") errors.phone = "required";
  if (draft.line1.trim() === "") errors.line1 = "required";
  if (draft.governorate.trim() === "") errors.governorate = "required";
  if (draft.lines.length === 0) {
    errors.lines = "empty";
  } else {
    errors.lines = draft.lines.map((line) => {
      const lineErrors: LineErrors = {};
      if (parseQuantity(line.quantity) === null)
        lineErrors.quantity = "invalid";
      if (line.unitPrice.trim() === "") {
        lineErrors.unitPrice = "required";
      } else if (parsePrice(line.unitPrice) === null) {
        lineErrors.unitPrice = "invalid";
      }
      return lineErrors;
    });
  }
  return errors;
}

/** Per-line errors, or none when the order has no lines yet. */
export function lineErrorsOf(errors: DraftErrors): LineErrors[] {
  return Array.isArray(errors.lines) ? errors.lines : [];
}

/** Sums only lines whose quantity and price parse; invalid lines count as zero. */
export function subtotalMinor(draft: OrderDraft): number {
  return draft.lines.reduce((sum, line) => {
    const quantity = parseQuantity(line.quantity);
    const price = parsePrice(line.unitPrice);
    return quantity !== null && price !== null ? sum + quantity * price : sum;
  }, 0);
}

export function addLine(
  draft: OrderDraft,
  variant: {
    sku: string;
    productName: string;
    priceMinor: number | null;
    currency: string;
  },
): OrderDraft {
  return {
    ...draft,
    lines: [
      ...draft.lines,
      {
        sku: variant.sku,
        productName: variant.productName,
        quantity: "1",
        unitPrice:
          variant.priceMinor === null
            ? ""
            : formatMinorAsMajor(variant.priceMinor),
        currency: variant.currency,
      },
    ],
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Call only after `validateOrderDraft` reports no errors. */
export function buildCreateOrderPayload(draft: OrderDraft): CreateOrderRequest {
  const fullName = optional(draft.fullName);
  const line2 = optional(draft.line2);
  const city = optional(draft.city);
  const externalOrderId = optional(draft.externalOrderId);
  const channel = optional(draft.channel) ?? "manual";
  return {
    customer: { phone: draft.phone.trim(), ...(fullName ? { fullName } : {}) },
    address: {
      line1: draft.line1.trim(),
      ...(line2 ? { line2 } : {}),
      ...(city ? { city } : {}),
      governorate: draft.governorate.trim(),
    },
    lines: draft.lines.map((line) => ({
      sku: line.sku,
      quantity: parseQuantity(line.quantity) ?? 0,
      unitPriceMinor: parsePrice(line.unitPrice) ?? 0,
      currency: line.currency,
    })),
    payment: { method: draft.paymentMethod },
    channel,
    ...(externalOrderId ? { externalOrderId } : {}),
  };
}
