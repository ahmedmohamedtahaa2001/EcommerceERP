import { keysetClause, type KeysetFilter } from "../platform/service";
import { utilizationPercent } from "./utilization";
import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type {
  BinListItem,
  BinRecord,
  BinStore,
  LocationRecord,
  LocationView,
  LocationStore,
  LocationType,
} from "./types";

interface LocationRow {
  id: string;
  tenant_id: string;
  type: string;
  name: string;
  code: string | null;
  governorate_code: string | null;
  address: string | null;
  capacity: number | null;
  used_units: number;
  created_at: Date;
  updated_at: Date;
}

interface BinRow {
  used: number;
  id: string;
  tenant_id: string;
  location_id: string;
  zone: string | null;
  code: string;
  capacity: number | null;
  created_at: Date;
  updated_at: Date;
}

function toLocation(row: LocationRow): LocationView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type as LocationType,
    name: row.name,
    code: row.code,
    governorateCode: row.governorate_code,
    address: row.address,
    capacity: row.capacity,
    usedUnits: row.used_units,
    utilizationPercent: utilizationPercent(row.used_units, row.capacity),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Units on hand at each location, computed alongside the location row. */
const USED_UNITS_SQL = `(select coalesce(sum(sb.quantity), 0)::int
     from stock_balances sb
    where sb.tenant_id = locations.tenant_id
      and sb.location_id = locations.id
      and sb.bucket = 'on_hand') as used_units`;

function toBin(row: BinRow): BinRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id,
    zone: row.zone,
    code: row.code,
    capacity: row.capacity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgLocationStore implements LocationStore {
  constructor(private readonly pool: Pool) {}

  async create(record: LocationRecord): Promise<void> {
    await withTenant(this.pool, record.tenantId, (client) =>
      client.query(
        `insert into locations
           (id, tenant_id, type, name, code, governorate_code, address, capacity,
            created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          record.id,
          record.tenantId,
          record.type,
          record.name,
          record.code,
          record.governorateCode,
          record.address,
          record.capacity,
          record.createdAt,
          record.updatedAt,
        ],
      ),
    );
  }

  async getById(tenantId: string, id: string): Promise<LocationView | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<LocationRow>(
        `select locations.*, ${USED_UNITS_SQL} from locations
          where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toLocation(row) : null;
    });
  }

  async list(
    tenantId: string,
    filter: KeysetFilter = {},
  ): Promise<LocationView[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      const limitClause = keysetClause(filter, conditions, params);
      const result = await client.query<LocationRow>(
        `select locations.*, ${USED_UNITS_SQL} from locations
          where ${conditions.join(" and ")}
          order by created_at desc, id desc${limitClause}`,
        params,
      );
      return result.rows.map(toLocation);
    });
  }

  async updateCapacity(
    tenantId: string,
    id: string,
    capacity: number | null,
  ): Promise<LocationView | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<LocationRow>(
        `update locations set capacity = $3, updated_at = now()
          where tenant_id = $1 and id = $2
          returning locations.*, ${USED_UNITS_SQL}`,
        [tenantId, id, capacity],
      );
      const row = result.rows[0];
      return row ? toLocation(row) : null;
    });
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `delete from locations where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      return result.rowCount === 1;
    });
  }
}

export class PgBinStore implements BinStore {
  constructor(private readonly pool: Pool) {}

  async create(record: BinRecord): Promise<void> {
    await withTenant(this.pool, record.tenantId, (client) =>
      client.query(
        `insert into bins
           (id, tenant_id, location_id, zone, code, capacity, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          record.id,
          record.tenantId,
          record.locationId,
          record.zone,
          record.code,
          record.capacity,
          record.createdAt,
          record.updatedAt,
        ],
      ),
    );
  }

  async getById(tenantId: string, id: string): Promise<BinRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<BinRow>(
        `select * from bins where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toBin(row) : null;
    });
  }

  async listByLocation(
    tenantId: string,
    locationId: string,
  ): Promise<BinListItem[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<BinRow>(
        `select b.*,
                coalesce((select sum(s.quantity) from bin_stock s
                           where s.bin_id = b.id), 0)::int as used
           from bins b
          where b.tenant_id = $1 and b.location_id = $2
          order by b.created_at asc, b.id asc`,
        [tenantId, locationId],
      );
      return result.rows.map((row) => ({ ...toBin(row), used: row.used }));
    });
  }
}
