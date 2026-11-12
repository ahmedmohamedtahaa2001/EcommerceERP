const ORDER_NUMBER_BASE = 10_000;

interface Queryable {
  query<T extends { next_number: number } = { next_number: number }>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

/**
 * Allocates the next order number for a tenant, formatted as `OP-10001`.
 * MUST be called with a client that is inside the same transaction as the
 * order insert it numbers: the increment and the order row commit or roll
 * back together, which is what makes the sequence gap-free.
 */
export async function allocateOrderNumber(
  client: Queryable,
  tenantId: string,
): Promise<string> {
  const result = await client.query(
    `insert into order_number_counters (tenant_id, next_number)
     values ($1, 1)
     on conflict (tenant_id) do update
       set next_number = order_number_counters.next_number + 1
     returning next_number`,
    [tenantId],
  );
  const nextNumber = result.rows[0]!.next_number;
  return `OP-${ORDER_NUMBER_BASE + nextNumber}`;
}
