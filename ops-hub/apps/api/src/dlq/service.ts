import { keysetClause } from "../platform/service";
import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export type DlqStatus = "dead" | "replayed" | "discarded";

export interface DlqEntryRecord {
  id: string;
  tenantId: string;
  source: string;
  payload: unknown;
  error: string;
  attempts: number;
  status: DlqStatus;
  createdAt: Date;
  replayedAt: Date | null;
}

/**
 * Dead-letter queue (roadmap P2-S8-T04): permanent failures are stored with
 * their payload and error, and can be replayed one at a time or in a batch.
 * Replay is idempotent — a replayed entry is not replayed twice.
 */
export class DlqService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
      /** Re-runs a dead payload. Returns true when it succeeded. */
      handler?: (source: string, payload: unknown) => Promise<boolean>;
    },
  ) {}

  async push(
    tenantId: string,
    input: {
      source: string;
      payload: unknown;
      error: string;
      attempts?: number;
    },
  ): Promise<DlqEntryRecord> {
    const id = randomUUID();
    const now = this.deps.clock.now();
    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `insert into dlq_entries (id, tenant_id, source, payload, error, attempts, status, created_at)
         values ($1,$2,$3,$4,$5,$6,'dead',$7)`,
        [
          id,
          tenantId,
          input.source,
          JSON.stringify(input.payload),
          input.error,
          input.attempts ?? 1,
          now,
        ],
      );
    });
    return {
      id,
      tenantId,
      source: input.source,
      payload: input.payload,
      error: input.error,
      attempts: input.attempts ?? 1,
      status: "dead",
      createdAt: now,
      replayedAt: null,
    };
  }

  async list(
    tenantId: string,
    filter: {
      status?: DlqStatus;
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    } = {},
  ): Promise<DlqEntryRecord[]> {
    return withTenant(this.deps.pool, tenantId, async (client) => {
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      if (filter.status) {
        params.push(filter.status);
        conditions.push(`status = $${params.length}`);
      }
      const limitClause = keysetClause(
        { limit: filter.limit, cursor: filter.cursor ?? null },
        conditions,
        params,
      );
      const r = await client.query<Record<string, unknown>>(
        `select * from dlq_entries where ${conditions.join(" and ")}
          order by created_at desc, id desc${limitClause}`,
        params,
      );
      return r.rows.map((row) => ({
        id: String(row.id),
        tenantId: String(row.tenant_id),
        source: String(row.source),
        payload: row.payload,
        error: String(row.error),
        attempts: Number(row.attempts),
        status: row.status as DlqStatus,
        createdAt: new Date(row.created_at as string),
        replayedAt: row.replayed_at
          ? new Date(row.replayed_at as string)
          : null,
      }));
    });
  }

  /** Replays one entry. Already-replayed entries are left alone, so a
   * double replay is a no-op. */
  async replay(
    tenantId: string,
    id: string,
  ): Promise<{ id: string; status: DlqStatus; ok: boolean }> {
    const entry = await withTenant(this.deps.pool, tenantId, async (client) => {
      const r = await client.query<Record<string, unknown>>(
        `select * from dlq_entries where tenant_id=$1 and id=$2`,
        [tenantId, id],
      );
      return r.rows[0];
    });
    if (!entry) throw new Error("DLQ entry not found.");
    if (entry.status !== "dead") {
      return { id, status: entry.status as DlqStatus, ok: false };
    }

    let ok = true;
    if (this.deps.handler) {
      ok = await this.deps.handler(String(entry.source), entry.payload);
    }

    await withTenant(this.deps.pool, tenantId, async (client) => {
      await client.query(
        `update dlq_entries set status=$3, replayed_at=now() where tenant_id=$1 and id=$2`,
        [tenantId, id, ok ? "replayed" : "dead"],
      );
    });
    return { id, status: ok ? "replayed" : "dead", ok };
  }

  async replayBatch(
    tenantId: string,
    ids: string[],
  ): Promise<{ replayed: number; skipped: number }> {
    let replayed = 0;
    let skipped = 0;
    for (const id of ids) {
      const result = await this.replay(tenantId, id);
      if (result.ok) replayed++;
      else skipped++;
    }
    return { replayed, skipped };
  }
}

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  /** Consecutive failures that open the circuit. */
  failureThreshold: number;
  /** Milliseconds the circuit stays open before a probe is allowed. */
  coolDownMs: number;
}

/**
 * Per-external-system circuit breaker (roadmap P2-S8-T05): opens after N
 * consecutive failures, cools down, then allows one half-open probe.
 */
export class CircuitBreaker {
  private readonly states = new Map<string, CircuitState>();
  private readonly failures = new Map<string, number>();
  private readonly openedAt = new Map<string, number>();

  constructor(
    private readonly config: CircuitBreakerConfig = {
      failureThreshold: 5,
      coolDownMs: 30_000,
    },
    private readonly clock: { now(): number } = { now: () => Date.now() },
  ) {}

  state(key: string): CircuitState {
    const current = this.states.get(key) ?? "closed";
    if (current !== "open") return current;
    const opened = this.openedAt.get(key) ?? 0;
    if (this.clock.now() - opened >= this.config.coolDownMs) {
      this.states.set(key, "half_open");
      return "half_open";
    }
    return "open";
  }

  /** True when a call is allowed right now. */
  canRequest(key: string): boolean {
    return this.state(key) !== "open";
  }

  onSuccess(key: string): void {
    this.states.set(key, "closed");
    this.failures.set(key, 0);
    this.openedAt.delete(key);
  }

  onFailure(key: string): void {
    const failures = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, failures);
    if (
      this.state(key) === "half_open" ||
      failures >= this.config.failureThreshold
    ) {
      this.states.set(key, "open");
      this.openedAt.set(key, this.clock.now());
    }
  }

  /** Runs `work` under the breaker; a thrown error counts as a failure. */
  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    if (!this.canRequest(key)) {
      throw new Error(`Circuit for ${key} is open.`);
    }
    try {
      const result = await work();
      this.onSuccess(key);
      return result;
    } catch (error) {
      this.onFailure(key);
      throw error;
    }
  }
}
