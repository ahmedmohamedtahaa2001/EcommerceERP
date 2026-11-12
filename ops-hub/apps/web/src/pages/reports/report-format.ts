import { formatMinorAsMajor } from "../../lib/money";
import type { KpiUnit } from "../../lib/api/reports";

/** Renders a KPI value in its unit. Money uses the business currency; percents keep one decimal. */
export function formatKpi(
  value: number,
  unit: KpiUnit,
  currency: string,
): string {
  switch (unit) {
    case "count":
      return String(Math.round(value));
    case "percent":
      return `${Math.round(value * 10) / 10}%`;
    case "hours":
      return `${Math.round(value * 10) / 10}`;
    case "minor":
      return `${formatMinorAsMajor(Math.round(value))} ${currency}`;
  }
}

/** The day a report is about, as YYYY-MM-DD in the viewer's calendar. */
export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
