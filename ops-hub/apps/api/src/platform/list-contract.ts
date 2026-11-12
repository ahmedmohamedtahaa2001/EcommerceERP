import type { FastifyInstance, FastifyRequest } from "fastify";

import { readPagination, type Cursor } from "./service";

/**
 * Shared list-endpoint contract (roadmap P4-S13-T03): every list route
 * accepts `limit` and `cursor`, rejects an invalid cursor with 400, and
 * answers with a `nextCursor`.
 */
export interface ListQuery {
  limit: number;
  cursor: Cursor | null;
}

/** Reads the pagination parameters of a list request. */
export function paginationOf(request: FastifyRequest): ListQuery {
  return readPagination((request.query ?? {}) as Record<string, unknown>);
}

/**
 * Adds the `limit`/`cursor` pre-handler to the app: an invalid cursor is a
 * 400 on every route, and the parsed values are cached on the request for
 * the handlers.
 */
export function registerPagination(app: FastifyInstance): void {
  app.addHook("preHandler", async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    if (query.limit === undefined && query.cursor === undefined) {
      return;
    }
    try {
      const { limit, cursor } = readPagination(query);
      (request as FastifyRequest & { listQuery?: ListQuery }).listQuery = {
        limit,
        cursor,
      };
    } catch (error) {
      reply.status(400);
      await reply.send({
        type: "https://ops-hub.local/problems/invalid-cursor",
        title: "Invalid cursor",
        status: 400,
        detail:
          error instanceof Error ? error.message : "The cursor is not valid.",
        instance: request.url,
        requestId: request.id,
      });
    }
  });
}

/**
 * Slices the rows a service returned (fetched with `limit + 1`) into a
 * page plus the cursor for the next one.
 */
export function toPage<T extends { id: string | number }>(
  rows: T[],
  limit: number,
  /** The timestamp the list is sorted by; defaults to `createdAt`. */
  timestampOf: (row: T) => string = (row) =>
    String(
      (row as { createdAt?: Date; updatedAt?: Date }).createdAt ??
        (row as { updatedAt?: Date }).updatedAt ??
        new Date(0),
    ),
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last !== undefined
        ? Buffer.from(
            JSON.stringify({
              createdAt: new Date(timestampOf(last)).toISOString(),
              id: String(last.id),
            }),
            "utf8",
          ).toString("base64url")
        : null,
  };
}
