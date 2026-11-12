import type { FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

/**
 * Rate limiting (roadmap P4-S13-T02): a fixed-window counter per key, kept
 * in Redis. Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`
 * and `X-RateLimit-Reset`; a breach returns 429 with `Retry-After`.
 */

export interface RateLimitStore {
  increment(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; resetAt: number }>;
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redis: {
      incr: (key: string) => Promise<number>;
      expire: (key: string, seconds: number) => unknown;
    },
  ) {}

  async increment(key: string, windowSeconds: number) {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    const ttl = await (
      this.redis as { ttl?: (k: string) => Promise<number> }
    ).ttl?.(key);
    const resetAt =
      Date.now() +
      (typeof ttl === "number" && ttl > 0 ? ttl : windowSeconds) * 1000;
    return { count, resetAt };
  }
}

/** In-memory store used by the tests and by single-process deployments. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<
    string,
    { count: number; resetAt: number }
  >();

  async increment(key: string, windowSeconds: number) {
    const now = Date.now();
    const existing = this.counters.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowSeconds * 1000 };
      this.counters.set(key, fresh);
      return fresh;
    }
    existing.count++;
    return existing;
  }
}

export interface RateLimitOptions {
  store: RateLimitStore;
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
  /** Key builder; defaults to the authenticated principal or the IP. */
  keyFor?: (request: FastifyRequest) => string;
}

export function registerRateLimit(
  app: {
    addHook: (
      name: "onRequest",
      fn: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
    ) => void;
  },
  options: RateLimitOptions,
): void {
  const keyFor =
    options.keyFor ??
    ((request: FastifyRequest) => {
      const apiKey = request.headers["x-api-key"];
      const auth = request.headers.authorization;
      const identity =
        (typeof apiKey === "string" && apiKey) ||
        (typeof auth === "string" ? auth : "") ||
        request.ip;
      return `ratelimit:${identity}`;
    });

  app.addHook("onRequest", async (request, reply) => {
    const { count, resetAt } = await options.store.increment(
      keyFor(request),
      options.windowSeconds,
    );
    const remaining = Math.max(0, options.limit - count);
    reply.header("x-ratelimit-limit", String(options.limit));
    reply.header("x-ratelimit-remaining", String(remaining));
    reply.header("x-ratelimit-reset", String(Math.ceil(resetAt / 1000)));
    if (count > options.limit) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      reply.header("retry-after", String(retryAfter));
      reply.status(429);
      await reply.send({
        type: "https://ops-hub.local/problems/rate-limited",
        title: "Too Many Requests",
        status: 429,
        detail: `Rate limit of ${options.limit} requests per ${options.windowSeconds}s exceeded.`,
        requestId: request.id,
      });
    }
  });
}

/**
 * Cursor pagination (roadmap P4-S13-T03). The cursor is the base64 of the
 * last row's sort key; an invalid cursor is a 400.
 */
export interface Cursor {
  /** ISO timestamp of the last row. */
  createdAt: string;
  /** Id of the last row, used as a tiebreaker. */
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<Cursor>;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export class PaginationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "PaginationError";
  }
}

/** Reads `limit` and `cursor` from the query, rejecting an invalid cursor. */
export function readPagination(
  query: Record<string, unknown>,
  defaultLimit = 25,
  maxLimit = 100,
): { limit: number; cursor: Cursor | null } {
  const rawLimit = query.limit;
  const limit =
    rawLimit === undefined
      ? defaultLimit
      : Math.min(Math.max(Number(rawLimit) || defaultLimit, 1), maxLimit);
  const rawCursor = query.cursor;
  let cursor: Cursor | null = null;
  if (typeof rawCursor === "string" && rawCursor !== "") {
    cursor = decodeCursor(rawCursor);
    if (!cursor) {
      throw new PaginationError("The cursor is not valid.");
    }
  }
  return { limit, cursor };
}

/** Builds the WHERE fragment that continues after a cursor. */
export function cursorPredicate(
  cursor: Cursor | null,
  column: string,
): { sql: string; params: unknown[] } {
  if (!cursor) return { sql: "", params: [] };
  return {
    sql: ` and (${column}, id) < ($1::timestamptz, $2::uuid)`,
    params: [cursor.createdAt, cursor.id],
  };
}

/** PII redaction (roadmap P4-S14-T04): phones and addresses are masked
 * unless the key carries `pii:read`. */
export function redactPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export function redactAddress(address: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
}): string {
  const parts = [address.line1, address.line2, address.city].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  if (parts.length === 0) return "***";
  return `${"*".repeat(3)} ${parts[parts.length - 1]}`;
}

/**
 * Agent safety controls (roadmap P4-S13-T04): dry-run, an approval gate for
 * actions above a threshold, per-key volume caps and a kill switch.
 */
export interface SafetyConfig {
  /** Actions above this amount need approval. */
  approvalThresholdMinor?: number;
  /** Max write calls per key per hour. */
  volumeCapPerHour?: number;
  /** Keys that are switched off. */
  disabledKeys?: Set<string>;
  /** Dry-run is on by default in the sandbox. */
  dryRun?: boolean;
}

export interface SafetyDecision {
  /** `execute` | `dry_run` | `pending_approval` | `blocked`. */
  outcome: "execute" | "dry_run" | "pending_approval" | "blocked";
  status: number;
  body: Record<string, unknown>;
}

export class SafetyGuard {
  private readonly volume = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(private readonly config: SafetyConfig = {}) {}

  check(input: {
    keyId: string;
    action: string;
    amountMinor?: number;
    dryRun?: boolean;
    now?: number;
  }): SafetyDecision {
    const now = input.now ?? Date.now();
    if (this.config.disabledKeys?.has(input.keyId)) {
      return {
        outcome: "blocked",
        status: 403,
        body: { error: "This API key is switched off." },
      };
    }

    const cap = this.config.volumeCapPerHour;
    if (cap !== undefined) {
      const existing = this.volume.get(input.keyId);
      if (!existing || existing.resetAt <= now) {
        this.volume.set(input.keyId, { count: 1, resetAt: now + 3600 * 1000 });
      } else {
        existing.count++;
        if (existing.count > cap) {
          return {
            outcome: "blocked",
            status: 429,
            body: { error: `Hourly volume cap of ${cap} reached.` },
          };
        }
      }
    }

    const threshold = this.config.approvalThresholdMinor;
    if (
      threshold !== undefined &&
      input.amountMinor !== undefined &&
      input.amountMinor > threshold
    ) {
      return {
        outcome: "pending_approval",
        status: 202,
        body: {
          status: "pending_approval",
          action: input.action,
          amountMinor: input.amountMinor,
          message: "This action needs approval before it runs.",
        },
      };
    }

    if (input.dryRun || this.config.dryRun) {
      return {
        outcome: "dry_run",
        status: 200,
        body: { dryRun: true, action: input.action, diff: [] },
      };
    }

    return { outcome: "execute", status: 200, body: {} };
  }
}

/**
 * Sandbox (roadmap P4-S13-T05): a separate tenant that can be reset to its
 * fixture state.
 */
export class SandboxService {
  constructor(private readonly deps: { pool: Pool }) {}

  /** Removes every row of a tenant's operational data, keeping the tenant
   * itself. */
  async reset(tenantId: string): Promise<{ tables: number }> {
    const tables = [
      "automation_runs",
      "automations",
      "segment_members",
      "segments",
      "consents",
      "customer_profiles",
      "macros",
      "ticket_messages",
      "tickets",
      "claims",
      "carrier_scorecards",
      "landed_costs",
      "supplier_scorecards",
      "po_events",
      "po_lines",
      "purchase_orders",
      "supplier_skus",
      "suppliers",
      "channels",
      "conversations",
      "dlq_entries",
      "settlement_lines",
      "settlement_files",
      "connectors",
      "refunds",
      "return_lines",
      "returns",
      "risk_scores",
      "cod_attempts",
      "cod_tasks",
      "cycle_counts",
      "receipt_lines",
      "receipts",
      "bin_stock",
      "shipment_events",
      "shipment_requests",
      "shipments",
      "order_events",
      "exceptions",
      "stock_balances",
      "stock_movements",
      "payments",
      "order_lines",
      "orders",
      "addresses",
      "customers",
      "alerts",
      "kpi_snapshots",
    ];
    for (const table of tables) {
      await this.deps.pool.query(`delete from ${table} where tenant_id=$1`, [
        tenantId,
      ]);
    }
    return { tables: tables.length };
  }
}
