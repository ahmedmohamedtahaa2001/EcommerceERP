import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import type { Permission } from "@ops-hub/domain";
import {
  cursorPredicate,
  encodeCursor,
  readPagination,
  type Cursor,
} from "./service";

export interface ListPage<T> {
  items: T[];
  /** Cursor for the next page, or null at the end. */
  nextCursor: string | null;
}

/**
 * Cursor pagination for a list route (roadmap P4-S13-T03). Every list
 * route answers `?cursor=` and `?limit=`, and returns `nextCursor` so a
 * client can walk the whole list without offsets drifting.
 */
export async function paginate<
  T extends {
    id: string;
    createdAt: Date;
  },
>(input: {
  pool: import("pg").Pool;
  tenantId: string;
  table: string;
  /** Extra WHERE clauses, already parameterised. */
  conditions?: string[];
  params?: unknown[];
  /** The column the list is sorted by; defaults to `created_at`. */
  sortColumn?: string;
  limit: number;
  cursor: Cursor | null;
}): Promise<ListPage<T>> {
  const sortColumn = input.sortColumn ?? "created_at";
  const conditions = ["tenant_id = $1"];
  const params: unknown[] = [input.tenantId];
  for (const condition of input.conditions ?? []) {
    params.push(...(input.params ?? []));
    conditions.push(condition);
  }
  const predicate = cursorPredicate(input.cursor, sortColumn);
  params.push(...predicate.params);
  const limitParam = params.push(input.limit + 1);

  const result = await input.pool.query<Record<string, unknown>>(
    `select * from ${input.table}
      where ${conditions.join(" and ")}${predicate.sql}
      order by ${sortColumn} desc, id desc
      limit $${limitParam}`,
    params,
  );

  const rows = result.rows;
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  const last = page[page.length - 1] as Record<string, unknown> | undefined;

  return {
    items: page as unknown as T[],
    nextCursor:
      hasMore && last !== undefined
        ? encodeCursor({
            createdAt: new Date(last.createdAt as string).toISOString(),
            id: String(last.id),
          })
        : null,
  };
}

/** Reads `limit`/`cursor` from the query of a list route. */
export function listQuery(request: { query: unknown }): {
  limit: number;
  cursor: Cursor | null;
} {
  const query = (request.query ?? {}) as Record<string, unknown>;
  return readPagination(query);
}

/**
 * Registers the shared list-endpoint contract: every list route answers
 * `limit`, `cursor` and `nextCursor`. This helper is used by the routes
 * that already page through SQL.
 */
export function registerListRoute(
  app: FastifyInstance,
  options: {
    method: "get";
    url: string;
    scope: Permission;
    requestAuth: RequestAuthenticator;
    handler: (input: {
      tenantId: string;
      limit: number;
      cursor: Cursor | null;
    }) => Promise<ListPage<{ id: string; createdAt: Date }>>;
  },
): void {
  app.get(
    options.url,
    { preHandler: requirePermission(options.requestAuth, options.scope) },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const { limit, cursor } = listQuery(request);
      return options.handler({ tenantId, limit, cursor });
    },
  );
}
