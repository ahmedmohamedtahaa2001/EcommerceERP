import { apiFetch } from "./client";

export interface DailyReport {
  date: string;
  ordersCreated: number;
  ordersByStatus: Record<string, number>;
  shipments: number;
  openExceptions: number;
  codExpectedMinor: number;
  codCollectedMinor: number;
}

export type KpiUnit = "count" | "percent" | "minor" | "hours";

export interface KpiValue {
  metric: string;
  value: number;
  unit: KpiUnit;
}

/** `GET /v1/reports/daily?date=YYYY-MM-DD` → 200. */
export function getDailyReport(date: string): Promise<DailyReport> {
  return apiFetch<DailyReport>("/v1/reports/daily", { searchParams: { date } });
}

/** `GET /v1/kpis?date=YYYY-MM-DD` → 200: every metric with its unit. */
export function listKpis(date: string): Promise<{ kpis: KpiValue[] }> {
  return apiFetch<{ kpis: KpiValue[] }>("/v1/kpis", { searchParams: { date } });
}
