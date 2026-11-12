import type { Locale } from "../i18n";

/**
 * Domain formatting helpers (UI_PLAN §4). Locale-aware via
 * `Intl.NumberFormat('ar-EG' | 'en-EG')`, defaulting to the stored locale
 * so plain imports work outside React.
 */

function currentLocale(): Locale {
  try {
    const raw = window.localStorage.getItem("ops-hub.locale");
    return raw === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar-EG" : "en-EG";
}

/**
 * Money is always integer minor units (piastres) — never floats.
 * `formatMoney(123456, "EGP")` → `1,234.56 ج.م` (ar) / `EGP 1,234.56` (en).
 */
export function formatMoney(
  minor: number,
  currency = "EGP",
  locale?: Locale,
): string {
  return new Intl.NumberFormat(intlLocale(locale ?? currentLocale()), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    currencyDisplay: "narrowSymbol",
  }).format(minor / 100);
}

export function formatNumber(value: number, locale?: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale ?? currentLocale())).format(
    value,
  );
}

export function formatDate(
  iso: string,
  locale?: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(
    intlLocale(locale ?? currentLocale()),
    options ?? {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(iso));
}

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.348121415],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/** "قبل ٣ ساعات" / "3 hours ago" — for timelines and audit rows. */
export function formatRelative(iso: string, locale?: Locale): string {
  const formatter = new Intl.RelativeTimeFormat(
    intlLocale(locale ?? currentLocale()),
    { numeric: "auto" },
  );
  let delta = (new Date(iso).getTime() - Date.now()) / 1000;
  const absDelta = Math.abs(delta);
  for (const [unit, span] of RELATIVE_UNITS) {
    if (absDelta < span) {
      return formatter.format(Math.round(delta), unit);
    }
    delta /= span;
  }
  return formatter.format(Math.round(delta), "year");
}

/** E.164 display: shown as-is; search accepts raw input (server normalizes). */
export function formatPhone(e164: string): string {
  return e164;
}
