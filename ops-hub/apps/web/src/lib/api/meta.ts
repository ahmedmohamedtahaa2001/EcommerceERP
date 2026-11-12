import { apiFetch } from "./client";

/**
 * Wire shapes for `/v1/meta/*` and `/v1/geo/*`, matching
 * `apps/api/src/meta/routes.ts`, `apps/api/src/geo/routes.ts`, and
 * `@ops-hub/domain` geo types.
 */

export const ADJUSTMENT_REASONS = [
  "COUNT_VARIANCE",
  "DAMAGE",
  "LOSS",
  "FOUND",
  "CORRECTION",
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** `GET /v1/meta/enums` → 200 (mirrors the server's source-of-truth arrays). */
export interface MetaEnums {
  adjustmentReasons: readonly AdjustmentReason[];
  stockBuckets: readonly string[];
}

/** Matches `Governorate` in @ops-hub/domain (packages/domain/src/geo.ts). */
export interface Governorate {
  code: string;
  nameEn: string;
  nameAr: string;
  aliases: string[];
}

/** Matches `District` in @ops-hub/domain. */
export interface District {
  code: string;
  governorateCode: string;
  nameEn: string;
  nameAr: string;
  aliases: string[];
}

/** `GET /v1/meta/enums` → 200. */
export function getEnums(): Promise<MetaEnums> {
  return apiFetch<MetaEnums>("/v1/meta/enums");
}

/** `GET /v1/geo/governorates` → 200 (27 Egyptian governorates). */
export function listGovernorates(): Promise<{ governorates: Governorate[] }> {
  return apiFetch<{ governorates: Governorate[] }>("/v1/geo/governorates");
}

/** `GET /v1/geo/districts?governorateCode` → 200 (all districts when omitted). */
export function listDistricts(params: {
  governorateCode?: string;
}): Promise<{ districts: District[] }> {
  return apiFetch<{ districts: District[] }>("/v1/geo/districts", {
    searchParams: params,
  });
}
