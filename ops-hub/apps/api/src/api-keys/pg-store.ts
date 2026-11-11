import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import type {
  ApiKeyRecord,
  ApiKeyStore,
  ApiKeySummary,
} from "./types";

interface ApiKeyRow {
  id: string;
  tenant_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: string[];
  ip_allowlist: string[] | null;
  created_by: string | null;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

function toRecord(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    keyHash: row.key_hash,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    ipAllowlist: row.ip_allowlist,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

function toSummary(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    ipAllowlist: row.ip_allowlist,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export class PgApiKeyStore implements ApiKeyStore {
  constructor(private readonly pool: Pool) {}

  async create(key: ApiKeyRecord): Promise<void> {
    await withTenant(this.pool, key.tenantId, (client) =>
      client.query(
        `insert into api_keys
           (id, tenant_id, name, key_hash, key_prefix, scopes, ip_allowlist,
            created_by, created_at, last_used_at, revoked_at)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11)`,
        [
          key.id,
          key.tenantId,
          key.name,
          key.keyHash,
          key.keyPrefix,
          JSON.stringify(key.scopes),
          key.ipAllowlist === null ? null : JSON.stringify(key.ipAllowlist),
          key.createdBy,
          key.createdAt,
          key.lastUsedAt,
          key.revokedAt,
        ],
      ),
    );
  }

  /**
   * Auth lookup: no tenant is known yet, so this goes through the
   * SECURITY DEFINER `find_api_key_by_hash` function (see migration 0003),
   * which also stamps `last_used_at`. Any role can call it; every other
   * access path stays tenant-scoped by RLS.
   */
  async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const result = await this.pool.query<ApiKeyRow>(
      "select * from find_api_key_by_hash($1)",
      [keyHash],
    );
    const row = result.rows[0];
    return row ? toRecord(row) : null;
  }

  async list(tenantId: string): Promise<ApiKeySummary[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ApiKeyRow>(
        `select * from api_keys
          where tenant_id = $1
          order by created_at desc, id desc`,
        [tenantId],
      );
      return result.rows.map(toSummary);
    });
  }

  async revoke(
    tenantId: string,
    id: string,
    revokedAt: Date,
  ): Promise<boolean> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `update api_keys
            set revoked_at = $3
          where id = $2
            and tenant_id = $1
            and revoked_at is null
          returning id`,
        [tenantId, id, revokedAt],
      );
      return result.rowCount === 1;
    });
  }
}
