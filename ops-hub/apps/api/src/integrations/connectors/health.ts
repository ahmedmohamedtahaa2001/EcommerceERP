import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export interface ConnectorHealth {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  enabled: boolean;
  lastSuccessAt: Date | null;
  lastError: string | null;
  tokenExpiresAt: Date | null;
  errorRate: number;
  paused: boolean;
}

export class ConnectorError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "ConnectorError";
    this.statusCode = statusCode;
  }
}

/**
 * Connector health (roadmap P1-S5-T03): last success, last error, token
 * expiry and error rate per connector. An expired token pauses the
 * connector's writes.
 */
export class ConnectorHealthService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
      /** No successful sync for this many minutes pauses the connector. */
      staleAfterMinutes?: number;
    },
  ) {}

  async register(
    tenantId: string,
    input: { name: string; type: string; tokenExpiresAt?: Date | null },
  ): Promise<ConnectorHealth> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const existing = await client.query<{ id: string }>(
        `select id from connectors where tenant_id=$1 and name=$2`,
        [tenantId, input.name],
      );
      if (existing.rows[0]) {
        const r = await client.query<Record<string, unknown>>(
          `update connectors set type=$3, token_expires_at=$4, updated_at=now()
            where tenant_id=$1 and id=$2 returning *`,
          [
            tenantId,
            existing.rows[0].id,
            input.type,
            input.tokenExpiresAt ?? null,
          ],
        );
        return this.toHealth(r.rows[0]!);
      }
      const r = await client.query<Record<string, unknown>>(
        `insert into connectors (tenant_id, name, type, token_expires_at)
         values ($1,$2,$3,$4) returning *`,
        [tenantId, input.name, input.type, input.tokenExpiresAt ?? null],
      );
      return this.toHealth(r.rows[0]!);
    });
  }

  async list(tenantId: string): Promise<ConnectorHealth[]> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `select * from connectors where tenant_id=$1 order by name asc`,
        [tenantId],
      );
      return r.rows.map((row) => this.toHealth(row));
    });
  }

  async recordSuccess(tenantId: string, name: string): Promise<void> {
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `update connectors set last_success_at=now(), last_error=null,
                success_count=success_count+1, error_count=0, updated_at=now()
          where tenant_id=$1 and name=$2`,
        [tenantId, name],
      );
    });
  }

  /** Records a failure. An expired token also pauses the connector. */
  async recordFailure(
    tenantId: string,
    name: string,
    error: string,
  ): Promise<ConnectorHealth> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const current = await client.query<{
        id: string;
        token_expires_at: Date | null;
      }>(
        `select id, token_expires_at from connectors where tenant_id=$1 and name=$2`,
        [tenantId, name],
      );
      const row = current.rows[0];
      if (!row) throw new ConnectorError("Connector not found.", 404);
      const expired =
        row.token_expires_at !== null &&
        new Date(row.token_expires_at).getTime() <=
          this.deps.clock.now().getTime();
      const r = await client.query<Record<string, unknown>>(
        `update connectors set last_error=$3, error_count=error_count+1,
                enabled = case when $4 then false else enabled end,
                updated_at=now()
          where tenant_id=$1 and id=$2 returning *`,
        [tenantId, row.id, error, expired],
      );
      return this.toHealth(r.rows[0]!);
    });
  }

  /** Connectors whose last successful sync is older than the threshold. */
  async stale(tenantId: string): Promise<ConnectorHealth[]> {
    const staleAfter = this.deps.staleAfterMinutes ?? 30;
    const all = await this.list(tenantId);
    const cutoff = this.deps.clock.now().getTime() - staleAfter * 60 * 1000;
    return all.filter(
      (c) => c.lastSuccessAt === null || c.lastSuccessAt.getTime() < cutoff,
    );
  }

  /** True when the connector may perform writes. */
  async canWrite(tenantId: string, name: string): Promise<boolean> {
    const all = await this.list(tenantId);
    const connector = all.find((c) => c.name === name);
    if (!connector) return false;
    if (!connector.enabled) return false;
    if (
      connector.tokenExpiresAt !== null &&
      connector.tokenExpiresAt.getTime() <= this.deps.clock.now().getTime()
    ) {
      return false;
    }
    return true;
  }

  private toHealth(row: Record<string, unknown>): ConnectorHealth {
    const errors = Number(row.error_count ?? 0);
    const successes = Number(row.success_count ?? 0);
    const total = errors + successes;
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      name: String(row.name),
      type: String(row.type),
      enabled: Boolean(row.enabled),
      lastSuccessAt: row.last_success_at
        ? new Date(row.last_success_at as string)
        : null,
      lastError: (row.last_error as string | null) ?? null,
      tokenExpiresAt: row.token_expires_at
        ? new Date(row.token_expires_at as string)
        : null,
      errorRate: total === 0 ? 0 : Math.round((errors / total) * 100),
      paused: row.enabled === false,
    };
  }
}
