export interface ShipmentRecord {
  id: string;
  tenantId: string;
  orderId: string;
  sequence: number;
  carrier: string;
  carrierShipmentId: string | null;
  trackingNumber: string | null;
  status: string;
  serviceLevel: string | null;
  labelUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShipmentEventRecord {
  id: string;
  tenantId: string;
  shipmentId: string;
  carrierStatus: string;
  status: string;
  occurredAt: Date;
  location: string | null;
  description: string | null;
  raw: string | null;
  createdAt: Date;
}

export interface ShipmentStore {
  getById(tenantId: string, id: string): Promise<ShipmentRecord | null>;
  getByTrackingNumber(
    tenantId: string,
    trackingNumber: string,
  ): Promise<ShipmentRecord | null>;
  getByOrderSequence(
    tenantId: string,
    orderId: string,
    sequence: number,
  ): Promise<ShipmentRecord | null>;
  create(
    tenantId: string,
    data: {
      orderId: string;
      sequence: number;
      carrier: string;
      carrierShipmentId: string | null;
      trackingNumber: string | null;
      status: string;
      serviceLevel: string | null;
      labelUrl: string | null;
    },
  ): Promise<ShipmentRecord>;
  updateStatus(
    tenantId: string,
    id: string,
    status: string,
    carrierShipmentId?: string | null,
    trackingNumber?: string | null,
  ): Promise<void>;
  addEvent(
    tenantId: string,
    shipmentId: string,
    event: {
      carrierStatus: string;
      status: string;
      occurredAt: Date;
      location?: string | null;
      description?: string | null;
      raw?: string | null;
    },
  ): Promise<ShipmentEventRecord>;
  listEvents(
    tenantId: string,
    shipmentId: string,
  ): Promise<ShipmentEventRecord[]>;
}

export interface ShipmentServiceDeps {
  store: ShipmentStore;
  carrier: import("@ops-hub/integrations").ShippingCarrier;
  clock: { now(): Date };
  orderStore?: {
    getById(
      tenantId: string,
      id: string,
    ): Promise<{ order: { id: string; status: string } } | null>;
    updateStatus(
      tenantId: string,
      orderId: string,
      status: string,
      actor?: { type: "user" | "api_key"; id: string } | null,
      note?: string,
    ): Promise<void>;
  };
}
