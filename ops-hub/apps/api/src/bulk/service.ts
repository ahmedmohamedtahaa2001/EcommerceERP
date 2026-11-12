import { withTenant } from "@ops-hub/db";
import type { Pool } from "pg";

import { PRODUCT_STATUSES } from "../catalog/types";
import { BulkValidationError } from "./errors";
import { requirePriceChange, type PriceMode } from "./validation";

export type BulkOutcome = "ok" | "skipped" | "not-found";

export interface BulkItemResult {
  id: string;
  outcome: BulkOutcome;
  /** How many rows were changed for this item (variants for prices, 1 for a status). */
  changed: number;
  reason?: string;
}

export interface BulkResult {
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
  items: BulkItemResult[];
}

function summarize(items: BulkItemResult[]): BulkResult {
  return {
    total: items.length,
    succeeded: items.filter((item) => item.outcome === "ok").length,
    skipped: items.filter((item) => item.outcome === "skipped").length,
    failed: items.filter((item) => item.outcome === "not-found").length,
    items,
  };
}

export class BulkService {
  constructor(private readonly pool: Pool) {}

  /** Sets the status of many products. Ids outside the tenant are reported, not changed. */
  async setProductStatus(
    tenantId: string,
    ids: string[],
    status: string,
  ): Promise<BulkResult> {
    if (!(PRODUCT_STATUSES as readonly string[]).includes(status)) {
      throw new BulkValidationError(
        `status must be one of: ${PRODUCT_STATUSES.join(", ")}.`,
      );
    }
    const updated = await withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `update products set status = $3, updated_at = now()
          where tenant_id = $1 and id = any($2::uuid[])
          returning id`,
        [tenantId, ids, status],
      );
      return new Set(result.rows.map((row) => row.id));
    });
    return summarize(
      ids.map((id) =>
        updated.has(id)
          ? { id, outcome: "ok", changed: 1 }
          : {
              id,
              outcome: "not-found",
              changed: 0,
              reason: "Product not found.",
            },
      ),
    );
  }

  /**
   * Changes the list price of every priced variant of the given products. A
   * percentage is rounded to the nearest minor unit and never goes below zero.
   * Products without any priced variant are skipped, not priced at zero.
   */
  async changeProductPrices(
    tenantId: string,
    productIds: string[],
    change: { mode: PriceMode; value: number },
  ): Promise<BulkResult> {
    const checked = requirePriceChange(change);
    return withTenant(this.pool, tenantId, async (client) => {
      const products = await client.query<{ id: string; priced: number }>(
        `select p.id,
                count(v.id) filter (where v.price_minor is not null)::int as priced
           from products p
           left join variants v on v.product_id = p.id and v.tenant_id = p.tenant_id
          where p.tenant_id = $1 and p.id = any($2::uuid[])
          group by p.id`,
        [tenantId, productIds],
      );
      const priced = new Map(products.rows.map((row) => [row.id, row.priced]));

      const changed = await client.query<{ product_id: string; count: number }>(
        checked.mode === "percent"
          ? `update variants set price_minor = greatest(0, round(price_minor * (1 + $3::numeric / 100)))::int,
                                 updated_at = now()
              where tenant_id = $1 and product_id = any($2::uuid[]) and price_minor is not null
              returning product_id, 1 as count`
          : `update variants set price_minor = $3::int, updated_at = now()
              where tenant_id = $1 and product_id = any($2::uuid[]) and price_minor is not null
              returning product_id, 1 as count`,
        [tenantId, productIds, checked.value],
      );
      const perProduct = new Map<string, number>();
      for (const row of changed.rows) {
        perProduct.set(
          row.product_id,
          (perProduct.get(row.product_id) ?? 0) + row.count,
        );
      }

      return summarize(
        productIds.map((id): BulkItemResult => {
          if (!priced.has(id)) {
            return {
              id,
              outcome: "not-found",
              changed: 0,
              reason: "Product not found.",
            };
          }
          const count = perProduct.get(id) ?? 0;
          if (count === 0) {
            return {
              id,
              outcome: "skipped",
              changed: 0,
              reason: "No priced variants to change.",
            };
          }
          return { id, outcome: "ok", changed: count };
        }),
      );
    });
  }
}
