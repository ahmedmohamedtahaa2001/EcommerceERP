import crypto from "node:crypto";

export interface ShopifyOrderPayload {
  id: number | string;
  name?: string;
  email?: string;
  phone?: string;
  line_items?: { sku: string; quantity: number; price: string }[];
  shipping_address?: {
    address1?: string;
    city?: string;
    province?: string;
  };
  financial_status?: string;
  currency?: string;
}

export function verifyShopifyHmac(
  secret: string,
  rawBody: string,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

export function mapShopifyOrder(payload: ShopifyOrderPayload): {
  externalOrderId: string;
  channel: string;
  customer: { phone: string; fullName?: string };
  address: { line1: string; governorate: string };
  lines: {
    sku: string;
    quantity: number;
    unitPriceMinor: number;
    currency: string;
  }[];
  payment: { method: "cod" | "prepaid" };
} {
  const phone = payload.phone ?? "";
  const line1 = payload.shipping_address?.address1 ?? "n/a";
  const gov = payload.shipping_address?.province ?? "Cairo";
  const currency = payload.currency ?? "EGP";
  const customer: { phone: string; fullName?: string } = { phone };
  if (payload.email) customer.fullName = payload.email;
  return {
    externalOrderId: String(payload.id),
    channel: "shopify",
    customer,
    address: { line1, governorate: gov },
    lines: (payload.line_items ?? []).map((li) => ({
      sku: li.sku,
      quantity: li.quantity,
      unitPriceMinor: Math.round(parseFloat(li.price || "0") * 100),
      currency,
    })),
    payment: {
      method: payload.financial_status === "paid" ? "prepaid" : "cod",
    },
  };
}
