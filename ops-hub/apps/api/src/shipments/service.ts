import type { ShippingCarrier } from "@ops-hub/integrations";

import type { ShipmentServiceDeps, ShipmentRecord } from "./types";

export class ShipmentService {
  constructor(private readonly deps: ShipmentServiceDeps) {}

  async createShipment(
    tenantId: string,
    params: {
      orderId: string;
      sequence?: number;
      carrier?: string;
      serviceLevel?: string;
      recipient: { name?: string; phone: string };
      address: { line1: string; governorateCode?: string };
      items: { sku: string; quantity: number }[];
      codAmount?: { amountMinor: number; currency: string };
    },
  ): Promise<ShipmentRecord> {
    const sequence = params.sequence ?? 1;
    const existing = await this.deps.store.getByOrderSequence(
      tenantId,
      params.orderId,
      sequence,
    );
    if (existing) return existing;

    const carrierCode = params.carrier ?? this.deps.carrier.carrierCode;
    const result = await this.deps.carrier.createShipment({
      tenantId,
      orderId: params.orderId,
      sequence,
      recipient: params.recipient,
      address: params.address,
      items: params.items,
      ...(params.codAmount ? { codAmount: params.codAmount } : {}),
      idempotencyKey: `${params.orderId}:${sequence}`,
    });

    const shipment = await this.deps.store.create(tenantId, {
      orderId: params.orderId,
      sequence,
      carrier: carrierCode,
      carrierShipmentId: result.carrierShipmentId,
      trackingNumber: result.trackingNumber,
      status: result.status,
      serviceLevel: params.serviceLevel ?? null,
      labelUrl: result.labelUrl ?? null,
    });

    await this.deps.store.addEvent(tenantId, shipment.id, {
      carrierStatus: result.status,
      status: result.status,
      occurredAt: this.deps.clock.now(),
      raw: JSON.stringify(result.raw ?? {}),
    });

    return shipment;
  }

  async getById(tenantId: string, id: string): Promise<ShipmentRecord> {
    const s = await this.deps.store.getById(tenantId, id);
    if (!s) throw new Error("Shipment not found");
    return s;
  }

  async getStatus(tenantId: string, id: string) {
    const s = await this.deps.store.getById(tenantId, id);
    if (!s) throw new Error("Shipment not found");
    const events = await this.deps.store.listEvents(tenantId, id);
    return { shipment: s, events };
  }
}
