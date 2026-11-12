import type {
  CarrierCapabilities,
  CarrierStatus,
  CreateShipmentRequest,
  CreateShipmentResult,
  GetLabelRequest,
  GetLabelResult,
  GetStatusRequest,
  GetStatusResult,
  QuoteRateRequest,
  RateQuote,
  ShippingCarrier,
  WebhookParseResult,
} from "@ops-hub/integrations";

export interface BostaAdapterConfig {
  apiKey: string;
  baseUrl: string; // e.g. https://api.bosta.co or fake courier url
  environment: "test" | "live";
}

/**
 * Bosta adapter. Endpoints are placeholders pending verification against
 * Bosta's official docs (see docs/decisions/0004-bosta.md). The adapter
 * targets a configurable baseUrl so contract tests run against the fake
 * courier without code changes.
 */
export class BostaAdapter implements ShippingCarrier {
  readonly carrierCode = "bosta";

  constructor(private readonly config: BostaAdapterConfig) {}

  capabilities(): CarrierCapabilities {
    return {
      cod: true,
      prepaid: true,
      labelFormats: ["pdf"],
      webhookSignature: "hmac-sha256",
      cancellationSupported: true,
    };
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  async quoteRate(req: QuoteRateRequest): Promise<RateQuote[]> {
    const res = await fetch(`${this.config.baseUrl}/v1/rates`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`bosta quoteRate failed: ${res.status}`);
    const data = (await res.json()) as { quotes: RateQuote[] };
    return (data.quotes ?? []).map((q) => ({
      ...q,
      carrier: this.carrierCode,
    }));
  }

  async createShipment(
    req: CreateShipmentRequest,
  ): Promise<CreateShipmentResult> {
    const res = await fetch(`${this.config.baseUrl}/v1/shipments`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        idempotencyKey: req.idempotencyKey,
        orderId: req.orderId,
        recipient: req.recipient,
        address: req.address,
        items: req.items,
        codAmount: req.codAmount,
      }),
    });
    if (!res.ok) throw new Error(`bosta createShipment failed: ${res.status}`);
    const data = (await res.json()) as {
      carrierShipmentId: string;
      trackingNumber: string;
      status: CarrierStatus;
      labelUrl?: string;
    };
    return { ...data, raw: data };
  }

  async cancelShipment(req: { carrierShipmentId: string; reason?: string }) {
    const res = await fetch(
      `${this.config.baseUrl}/v1/shipments/${encodeURIComponent(req.carrierShipmentId)}/cancel`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ reason: req.reason }),
      },
    );
    if (!res.ok) throw new Error(`bosta cancelShipment failed: ${res.status}`);
    const data = (await res.json()) as { cancelled: boolean };
    return { cancelled: data.cancelled, raw: data };
  }

  async getLabel(req: GetLabelRequest): Promise<GetLabelResult> {
    const res = await fetch(
      `${this.config.baseUrl}/v1/shipments/${encodeURIComponent(req.carrierShipmentId)}/label`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`bosta getLabel failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      contentType: res.headers.get("content-type") ?? "application/pdf",
      data: buf,
      raw: {},
    };
  }

  async getStatus(req: GetStatusRequest): Promise<GetStatusResult> {
    const id = req.carrierShipmentId ?? req.trackingNumber ?? "";
    const res = await fetch(
      `${this.config.baseUrl}/v1/shipments/${encodeURIComponent(id)}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`bosta getStatus failed: ${res.status}`);
    const data = (await res.json()) as {
      current: CarrierStatus;
      events: {
        carrierStatus: string;
        status: CarrierStatus;
        occurredAt: string;
      }[];
      trackingNumber?: string;
    };
    return {
      current: data.current,
      events: (data.events ?? []).map((e) => ({
        carrierStatus: e.carrierStatus,
        status: e.status,
        occurredAt: new Date(e.occurredAt),
        raw: e,
      })),
      raw: data,
    };
  }

  async parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<WebhookParseResult> {
    const b = (body ?? {}) as Record<string, unknown>;
    const result: WebhookParseResult = {
      eventId: String(b.eventId ?? b.id ?? ""),
      event: {
        carrierStatus: String(b.status ?? ""),
        status: (b.status as CarrierStatus) ?? "label_created",
        occurredAt: b.occurredAt ? new Date(String(b.occurredAt)) : new Date(),
        raw: body,
      },
      raw: body,
    };
    const csid = (b.shipmentId ?? b.carrierShipmentId) as string | undefined;
    if (csid) result.carrierShipmentId = csid;
    const tn = b.trackingNumber as string | undefined;
    if (tn) result.trackingNumber = tn;
    return result;
  }
}
