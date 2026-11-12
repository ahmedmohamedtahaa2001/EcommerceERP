/**
 * Shipping port — the contract every courier adapter (Bosta, Posta, J&T, ...)
 * must implement. Adapters live in `apps/api/src/integrations/<carrier>/` and
 * are tested against the fake courier (see `fixtures/courier`) with the shared
 * contract suite in `packages/integrations/tests/contract.test.ts`.
 *
 * Money is passed as integer minor units + currency code, consistent with the
 * rest of Ops Hub (never floats).
 */

export type CarrierCode = string;

export type CarrierStatus =
  | "label_created"
  | "handed_to_carrier"
  | "carrier_accepted"
  | "in_transit"
  | "arrived_hub"
  | "out_for_delivery"
  | "delivered"
  | "delivery_exception"
  | "returned_to_sender"
  | "lost_claim_required"
  | "cancelled";

export interface MoneyAmount {
  amountMinor: number;
  currency: string;
}

export interface AddressInput {
  line1: string;
  line2?: string;
  city?: string;
  governorateCode?: string;
  country?: string;
  postalCode?: string;
}

export interface RecipientInput {
  name?: string;
  phone: string; // E.164
}

export interface ShipmentItem {
  sku: string;
  quantity: number;
  description?: string;
  weightGrams?: number;
}

export interface CarrierCapabilities {
  cod: boolean;
  prepaid: boolean;
  labelFormats: string[];
  webhookSignature: "hmac-sha256" | "none";
  cancellationSupported: boolean;
}

export interface QuoteRateRequest {
  originLocationId?: string;
  destination: AddressInput;
  items: ShipmentItem[];
  codAmount?: MoneyAmount;
  serviceLevel?: string;
}

export interface RateQuote {
  carrier: CarrierCode;
  serviceLevel: string;
  priceMinor: number;
  currency: string;
  etaDays?: number;
  raw?: unknown;
}

export interface CreateShipmentRequest {
  tenantId: string;
  orderId: string;
  orderNumber?: string;
  sequence: number;
  recipient: RecipientInput;
  address: AddressInput;
  items: ShipmentItem[];
  codAmount?: MoneyAmount;
  prepaidAmount?: MoneyAmount;
  serviceLevel?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface CreateShipmentResult {
  carrierShipmentId: string;
  trackingNumber: string;
  status: CarrierStatus;
  labelUrl?: string;
  raw: unknown;
}

export interface CancelShipmentRequest {
  carrierShipmentId: string;
  reason?: string;
}

export interface CancelShipmentResult {
  cancelled: boolean;
  raw?: unknown;
}

export interface GetLabelRequest {
  carrierShipmentId: string;
  format?: string;
}

export interface GetLabelResult {
  contentType: string;
  data: Buffer | string;
  url?: string;
  raw?: unknown;
}

export interface CarrierStatusEvent {
  carrierStatus: string; // raw code from the carrier
  status: CarrierStatus; // normalized
  occurredAt: Date;
  location?: string;
  description?: string;
  raw?: unknown;
}

export interface GetStatusRequest {
  carrierShipmentId?: string;
  trackingNumber?: string;
}

export interface GetStatusResult {
  current: CarrierStatus;
  events: CarrierStatusEvent[];
  raw?: unknown;
}

export interface WebhookParseResult {
  eventId: string; // for dedup across redeliveries
  carrierShipmentId?: string;
  trackingNumber?: string;
  event: CarrierStatusEvent;
  raw: unknown;
}

export interface ShippingCarrier {
  readonly carrierCode: CarrierCode;
  capabilities(): CarrierCapabilities;
  quoteRate(req: QuoteRateRequest): Promise<RateQuote[]>;
  createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult>;
  cancelShipment(req: CancelShipmentRequest): Promise<CancelShipmentResult>;
  getLabel(req: GetLabelRequest): Promise<GetLabelResult>;
  getStatus(req: GetStatusRequest): Promise<GetStatusResult>;
  parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<WebhookParseResult>;
}
