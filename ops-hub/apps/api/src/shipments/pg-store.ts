import { withTenant } from "@ops-hub/db";

import { keysetClause } from "../platform/service";
import type { Pool } from "pg";

import type {
  ShipmentEventRecord,
  ShipmentRecord,
  ShipmentStore,
} from "./types";

interface ShipmentRow {
  id: string;
  tenant_id: string;
  order_id: string;
  sequence: number;
  carrier: string;
  carrier_shipment_id: string | null;
  tracking_number: string | null;
  status: string;
  service_level: string | null;
  label_url: string | null;
  created_at: Date;
  updated_at: Date;
}

function toShipment(row: ShipmentRow): ShipmentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    sequence: row.sequence,
    carrier: row.carrier,
    carrierShipmentId: row.carrier_shipment_id,
    trackingNumber: row.tracking_number,
    status: row.status,
    serviceLevel: row.service_level,
    labelUrl: row.label_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgShipmentStore implements ShipmentStore {
  constructor(private readonly pool: Pool) {}

  async getById(tenantId: string, id: string): Promise<ShipmentRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query<ShipmentRow>(
        `select * from shipments where tenant_id=$1 and id=$2`,
        [tenantId, id],
      );
      return r.rows[0] ? toShipment(r.rows[0]) : null;
    });
  }

  async getByOrderSequence(
    tenantId: string,
    orderId: string,
    sequence: number,
  ): Promise<ShipmentRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query<ShipmentRow>(
        `select * from shipments where tenant_id=$1 and order_id=$2 and sequence=$3`,
        [tenantId, orderId, sequence],
      );
      return r.rows[0] ? toShipment(r.rows[0]) : null;
    });
  }

  async list(
    tenantId: string,
    filter: {
      orderId?: string;
      status?: string;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    } = {},
  ): Promise<ShipmentRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.orderId) {
        params.push(filter.orderId);
        conditions.push(`order_id = $${params.length}`);
      }
      if (filter.status) {
        params.push(filter.status);
        conditions.push(`status = $${params.length}`);
      }
      const limitClause = keysetClause(
        { limit: filter.limit, cursor: filter.cursor ?? null },
        conditions,
        params,
      );
      const r = await client.query<ShipmentRow>(
        `select * from shipments where ${conditions.join(" and ")}
          order by created_at desc, id desc${limitClause}`,
        params,
      );
      return r.rows.map(toShipment);
    });
  }

  async getByTrackingNumber(
    tenantId: string,
    trackingNumber: string,
  ): Promise<ShipmentRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query<ShipmentRow>(
        `select * from shipments where tenant_id=$1 and tracking_number=$2
         order by created_at desc limit 1`,
        [tenantId, trackingNumber],
      );
      return r.rows[0] ? toShipment(r.rows[0]) : null;
    });
  }

  async create(
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
  ): Promise<ShipmentRecord> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query<ShipmentRow>(
        `insert into shipments
           (tenant_id, order_id, sequence, carrier, carrier_shipment_id, tracking_number, status, service_level, label_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         returning *`,
        [
          tenantId,
          data.orderId,
          data.sequence,
          data.carrier,
          data.carrierShipmentId,
          data.trackingNumber,
          data.status,
          data.serviceLevel,
          data.labelUrl,
        ],
      );
      return toShipment(r.rows[0]!);
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: string,
    carrierShipmentId?: string | null,
    trackingNumber?: string | null,
  ): Promise<void> {
    await withTenant(this.pool, tenantId, async (client) => {
      await client.query(
        `update shipments set status=$3,
            carrier_shipment_id=coalesce($4, carrier_shipment_id),
            tracking_number=coalesce($5, tracking_number),
            updated_at=now()
          where tenant_id=$1 and id=$2`,
        [
          tenantId,
          id,
          status,
          carrierShipmentId ?? null,
          trackingNumber ?? null,
        ],
      );
    });
  }

  async addEvent(
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
  ): Promise<ShipmentEventRecord> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query<{
        id: string;
        tenant_id: string;
        shipment_id: string;
        carrier_status: string;
        status: string;
        occurred_at: Date;
        location: string | null;
        description: string | null;
        raw: string | null;
        created_at: Date;
      }>(
        `insert into shipment_events
           (tenant_id, shipment_id, carrier_status, status, occurred_at, location, description, raw)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning *`,
        [
          tenantId,
          shipmentId,
          event.carrierStatus,
          event.status,
          event.occurredAt,
          event.location ?? null,
          event.description ?? null,
          event.raw ?? null,
        ],
      );
      const row = r.rows[0]!;
      return {
        id: row.id,
        tenantId: row.tenant_id,
        shipmentId: row.shipment_id,
        carrierStatus: row.carrier_status,
        status: row.status,
        occurredAt: row.occurred_at,
        location: row.location,
        description: row.description,
        raw: row.raw,
        createdAt: row.created_at,
      };
    });
  }

  async listEvents(
    tenantId: string,
    shipmentId: string,
  ): Promise<ShipmentEventRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query<{
        id: string;
        tenant_id: string;
        shipment_id: string;
        carrier_status: string;
        status: string;
        occurred_at: Date;
        location: string | null;
        description: string | null;
        raw: string | null;
        created_at: Date;
      }>(
        `select * from shipment_events where tenant_id=$1 and shipment_id=$2 order by occurred_at asc, id asc`,
        [tenantId, shipmentId],
      );
      return r.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        shipmentId: row.shipment_id,
        carrierStatus: row.carrier_status,
        status: row.status,
        occurredAt: row.occurred_at,
        location: row.location,
        description: row.description,
        raw: row.raw,
        createdAt: row.created_at,
      }));
    });
  }
}
