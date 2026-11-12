import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

export interface RoutingCandidate {
  locationId: string;
  availableToPromise: number;
  coverage: string[];
  costMinor: number;
}

export interface RoutingDecision {
  locationId: string;
  carrier: string;
  reasons: string[];
}

export interface CarrierOption {
  carrier: string;
  /** Governorates the carrier delivers to. */
  coverage: string[];
  supportsCod: boolean;
  onTimeRate: number;
  costMinor: number;
}

/**
 * Routing v1 (roadmap P2-S8-T08): pick the fulfilment location by
 * availability, then governorate coverage, then cost; pick the carrier by
 * coverage, COD support and historical on-time rate. Deterministic: ties are
 * broken by the lowest cost, then alphabetically.
 */
export function route(input: {
  governorateCode: string;
  requiredQuantity: number;
  locations: RoutingCandidate[];
  carriers: CarrierOption[];
}): RoutingDecision | null {
  const reasons: string[] = [];

  const eligible = input.locations.filter(
    (l) => l.availableToPromise >= input.requiredQuantity,
  );
  if (eligible.length === 0) {
    reasons.push("no location has enough stock");
    return null;
  }
  const withCoverage = eligible.filter((l) =>
    l.coverage.includes(input.governorateCode),
  );
  const locationPool = withCoverage.length > 0 ? withCoverage : eligible;
  if (withCoverage.length > 0) {
    reasons.push(`${withCoverage.length} location(s) cover the governorate`);
  } else {
    reasons.push("no location covers the governorate; using availability");
  }

  const bestLocation = [...locationPool].sort((a, b) => {
    if (a.costMinor !== b.costMinor) return a.costMinor - b.costMinor;
    return a.locationId.localeCompare(b.locationId);
  })[0]!;

  const usableCarriers = input.carriers.filter((c) => c.supportsCod);
  const carrierPool =
    usableCarriers.length > 0 ? usableCarriers : input.carriers;
  if (usableCarriers.length > 0) {
    reasons.push(`${usableCarriers.length} carrier(s) support COD`);
  } else {
    reasons.push("no carrier supports COD; falling back to the full list");
  }
  const covered = carrierPool.filter((c) =>
    c.coverage.includes(input.governorateCode),
  );
  const carrierCandidatePool = covered.length > 0 ? covered : carrierPool;
  if (covered.length > 0) {
    reasons.push(`${covered.length} carrier(s) deliver to the governorate`);
  }

  const bestCarrier = [...carrierCandidatePool].sort((a, b) => {
    if (b.onTimeRate !== a.onTimeRate) return b.onTimeRate - a.onTimeRate;
    if (a.costMinor !== b.costMinor) return a.costMinor - b.costMinor;
    return a.carrier.localeCompare(b.carrier);
  })[0];

  if (!bestCarrier) {
    reasons.push("no carrier available");
    return null;
  }

  return {
    locationId: bestLocation.locationId,
    carrier: bestCarrier.carrier,
    reasons,
  };
}

export class RoutingService {
  constructor(private readonly pool: Pool) {}

  /** Explains the routing choice for an order. */
  async preview(
    tenantId: string,
    orderId: string,
  ): Promise<{
    decision: RoutingDecision | null;
    candidates: RoutingCandidate[];
  }> {
    return withTenant(this.pool, tenantId, async (client) => {
      const order = await client.query<{
        quantity: number;
        governorate_code: string | null;
        cod: boolean;
      }>(
        `select coalesce(sum(ol.quantity),0)::int as quantity,
                a.governorate_code,
                (select count(*) from payments p
                  where p.tenant_id=o.tenant_id and p.order_id=o.id and p.method='cod') > 0 as cod
           from orders o
           join order_lines ol on ol.order_id = o.id and ol.tenant_id = o.tenant_id
           left join addresses a on a.id = o.address_id
          where o.tenant_id=$1 and o.id=$2
          group by a.governorate_code, o.id`,
        [tenantId, orderId],
      );
      const row = order.rows[0];
      if (!row) throw new Error("Order not found.");

      const balances = await client.query<{
        location_id: string;
        available: string;
      }>(
        `select location_id,
                coalesce(sum(case when bucket='on_hand' then quantity
                                 when bucket in ('reserved','quarantined','damaged') then -quantity
                                 else 0 end),0)::text as available
           from stock_balances
          where tenant_id=$1
          group by location_id`,
        [tenantId],
      );

      const candidates: RoutingCandidate[] = balances.rows.map((b) => ({
        locationId: b.location_id,
        availableToPromise: Number(b.available),
        coverage: [],
        costMinor: 0,
      }));

      const carriers = await client.query<{ carrier: string }>(
        `select distinct carrier from shipments where tenant_id=$1 order by carrier asc`,
        [tenantId],
      );

      const decision = route({
        governorateCode: row.governorate_code ?? "",
        requiredQuantity: row.quantity,
        locations: candidates,
        carriers: carriers.rows.map((c) => ({
          carrier: c.carrier,
          coverage: [],
          supportsCod: row.cod,
          onTimeRate: 1,
          costMinor: 0,
        })),
      });
      return { decision, candidates };
    });
  }
}
