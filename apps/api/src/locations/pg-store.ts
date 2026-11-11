import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type {
  BinRecord,
  LocationRecord,
  LocationStore,
} from "./types";

interface LocationRow {
  id: string;
  tenant_id: string;
  type: string;
  name: string;
  code: string | null;
  governorate_code: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
}

interface BinRow {
  id: string;
  tenant_id: string;
  location_id: string;
  zone: string | null;
  code: string;
  capacity: number | null;
  created_at: Date;
  updated_at: Date;
}

function toLocation(row: LocationRow): LocationRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type as LocationRecord["type"],
    name: row.name,
    code: row.code,
    governorateCode: row.governorate_code,
    address: row.address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

  async createLocation(location: LocationRecord): Promise<void> {
    await withTenant(this.pool, location.tenantId, (client) =>
      client.query(
        `insert into locations
           (id, tenant_id, type, name, code, governorate_code, address, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          location.id,
          location.tenantId,
          location.type,
          location.name,
          location.code,
          location.governorateCode,
          location.address,
          location.createdAt,
          location.updatedAt,
        ],
      ),
    );
  }

  async getLocation(tenantId: string, id: string): Promise<LocationRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<LocationRow>(
        `select * from locations where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toLocation(row) : null;
    });
  }

  async listLocations(tenantId: string): Promise<LocationRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<LocationRow>(
        `select * from locations where tenant_id = $1 order by created_at desc, id desc`,
        [tenantId],
      );
      return result.rows.map(toLocation);
    });
  }

  async updateLocation(location: LocationRecord): Promise<boolean> {
    return withTenant(this.pool, location.tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `update locations
            set type = $3, name = $4, code = $5, governorate_code = $6,
                address = $7, updated_at = $8
          where id = $1 and tenant_id = $2
          returning id`,
        [
          location.id,
          location.tenantId,
          location.type,
          location.name,
          location.code,
          location.governorateCode,
          location.address,
          location.updatedAt,
        ],
      );
      return result.rowCount === 1;
    });
  }

  async deleteLocation(
    tenantId: string,
    id: string,
  ): Promise<"deleted" | "has_stock" | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      try {
        const result = await client.query<{ id: string }>(
          `delete from locations where id = $2 and tenant_id = $1 returning id`,
          [tenantId, id],
        );
        if (result.rowCount !== 1) return null;
        return "deleted";
      } catch (error) {
        if ((error as { code?: string }).code === "23503") {
          return "has_stock";
        }
        throw error;
      }
    });
  }

  async createBin(bin: BinRecord): Promise<void> {
    await withTenant(this.pool, bin.tenantId, (client) =>
      client.query(
        `insert into bins
           (id, tenant_id, location_id, zone, code, capacity, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          bin.id,
          bin.tenantId,
          bin.locationId,
          bin.zone,
          bin.code,
          bin.capacity,
          bin.createdAt,
          bin.updatedAt,
        ],
      ),
    );
  }

  async getBin(tenantId: string, id: string): Promise<BinRecord | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<BinRow>(
        `select * from bins where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      const row = result.rows[0];
      return row ? toBin(row) : null;
    });
  }

  async listBinsByLocation(tenantId: string, locationId: string): Promise<BinRecord[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<BinRow>(
        `select * from bins where tenant_id = $1 and location_id = $2 order by created_at asc, id asc`,
        [tenantId, locationId],
      );
      return result.rows.map(toBin);
    });
  }

  async updateBin(bin: BinRecord): Promise<boolean> {
    return withTenant(this.pool, bin.tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `update bins
            set zone = $3, code = $4, capacity = $5, updated_at = $6
          where id = $1 and tenant_id = $2
          returning id`,
        [bin.id, bin.tenantId, bin.zone, bin.code, bin.capacity, bin.updatedAt],
      );
      return result.rowCount === 1;
    });
  }

  async deleteBin(tenantId: string, id: string): Promise<"deleted" | "has_stock" | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      try {
        const result = await client.query<{ id: string }>(
          `delete from bins where id = $2 and tenant_id = $1 returning id`,
          [tenantId, id],
        );
        if (result.rowCount !== 1) return null;
        return "deleted";
      } catch (error) {
        if ((error as { code?: string }).code === "23503") {
          return "has_stock";
        }
        throw error;
      }
    });
  }
}
