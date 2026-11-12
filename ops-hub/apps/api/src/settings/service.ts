import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export class SettingsError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "SettingsError";
    this.statusCode = statusCode;
  }
}

/**
 * Tenant settings (roadmap P2-S7-T03 asks for the risk thresholds to live
 * here, not in code). A setting is a JSON value under a string key, scoped
 * to one tenant.
 */
export class TenantSettingsService {
  constructor(private readonly pool: Pool) {}

  async get<T>(tenantId: string, key: string, fallback: T): Promise<T> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query<{ value: unknown }>(
        `select value from tenant_settings where tenant_id=$1 and key=$2`,
        [tenantId, key],
      );
      const row = r.rows[0];
      return row === undefined ? fallback : (row.value as T);
    });
  }

  async set<T>(tenantId: string, key: string, value: T): Promise<T> {
    await withTenant(this.pool, tenantId, async (client) => {
      await client.query(
        `insert into tenant_settings (tenant_id, key, value)
         values ($1,$2,$3)
         on conflict (tenant_id, key) do update set value=$3, updated_at=now()`,
        [tenantId, key, JSON.stringify(value)],
      );
    });
    return value;
  }

  async list(tenantId: string): Promise<Record<string, unknown>> {
    return withTenant(this.pool, tenantId, async (client) => {
      const r = await client.query<{ key: string; value: unknown }>(
        `select key, value from tenant_settings where tenant_id=$1 order by key asc`,
        [tenantId],
      );
      return Object.fromEntries(r.rows.map((row) => [row.key, row.value]));
    });
  }
}

export interface RiskThresholds {
  /** Points at which an order becomes medium risk. */
  medium: number;
  /** Points at which an order becomes high risk. */
  high: number;
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  medium: 25,
  high: 60,
};

/** Reads the risk thresholds from tenant settings, falling back to the
 * defaults. */
export async function riskThresholds(
  settings: TenantSettingsService,
  tenantId: string,
): Promise<RiskThresholds> {
  const stored = await settings.get<Partial<RiskThresholds>>(
    tenantId,
    "risk_thresholds",
    {},
  );
  return {
    medium: stored.medium ?? DEFAULT_RISK_THRESHOLDS.medium,
    high: stored.high ?? DEFAULT_RISK_THRESHOLDS.high,
  };
}
