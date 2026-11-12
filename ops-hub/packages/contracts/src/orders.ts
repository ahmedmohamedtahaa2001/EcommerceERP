import { z } from "zod";

export const orderLineInputSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  /** Price at the moment of the order, independent of the catalog's
   * current price — the catalog doesn't model price yet, and even once it
   * does, an order must keep the price it was actually placed at. */
  unitPriceMinor: z.number().int().nonnegative(),
  currency: z.string().length(3).default("EGP"),
});

export const createOrderAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().optional(),
  /** Free text as the customer/channel wrote it; resolved against
   * `resolveGovernorate` server-side. */
  governorate: z.string().min(1),
});

export const createOrderCustomerSchema = z.object({
  phone: z.string().min(1),
  fullName: z.string().optional(),
});

export const createOrderPaymentSchema = z.object({
  method: z.enum(["cod", "prepaid"]),
});

export const createOrderRequestSchema = z.object({
  customer: createOrderCustomerSchema,
  address: createOrderAddressSchema,
  lines: z.array(orderLineInputSchema).min(1),
  payment: createOrderPaymentSchema,
  channel: z.string().optional(),
  externalOrderId: z.string().optional(),
});

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type OrderLineInput = z.infer<typeof orderLineInputSchema>;
