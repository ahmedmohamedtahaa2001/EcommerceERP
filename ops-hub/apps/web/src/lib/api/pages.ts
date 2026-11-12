/** Largest page the API serves. */
export const PAGE_LIMIT = 100;
/** Stops a runaway loop; screens that can exceed this need server-side search. */
export const MAX_ROWS = 5000;

type Page<K extends string, T> = { [key in K]: T[] } & {
  nextCursor?: string | null;
};

/**
 * Follows `nextCursor` until the list is complete, so a screen never silently
 * shows only the first page of a list endpoint.
 */
export async function fetchAllPages<K extends string, T>(
  key: K,
  fetchPage: (params: {
    limit: number;
    cursor?: string | undefined;
  }) => Promise<Page<K, T>>,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage({
      limit: PAGE_LIMIT,
      ...(cursor ? { cursor } : {}),
    });
    rows.push(...page[key]);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && rows.length < MAX_ROWS);
  return rows;
}
