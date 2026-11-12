import { useContext } from "react";
import { createContext } from "react";

import { ar } from "./ar";
import { en } from "./en";

// Per-domain page dictionaries (each owned by the pages/ agent of that domain;
// merged into the global key space — keys must stay unique across domains).
import { dict as dashboardDict } from "../../pages/dashboard/i18n";
import { dict as ordersDict } from "../../pages/orders/i18n";
import { dict as productsDict } from "../../pages/products/i18n";
import { dict as exportsDict } from "../../pages/exports/i18n";
import { dict as inventoryDict } from "../../pages/inventory/i18n";
import { dict as authDict } from "../../pages/auth/i18n";
import { dict as adminDict } from "../../pages/admin/i18n";
import { dict as agentsDict } from "../../pages/agents/i18n";
import { dict as analyticsDict } from "../../pages/analytics/i18n";
import { dict as customersDict } from "../../pages/customers/i18n";

const DOMAIN_DICTS = [
  dashboardDict,
  ordersDict,
  productsDict,
  exportsDict,
  inventoryDict,
  authDict,
  adminDict,
  agentsDict,
  analyticsDict,
  customersDict,
] as const;

/**
 * Key-based i18n (UI_PLAN §3). Locale state lives in `I18nContext`, provided
 * by `app/providers.tsx`; `useT()` returns the translator for the active
 * locale. Persisted in localStorage under `ops-hub.locale` (default "ar",
 * dir="rtl"), and `documentElement.lang/dir` are kept in sync.
 */

export type Locale = "ar" | "en";

export const LOCALE_STORAGE_KEY = "ops-hub.locale";

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  ar: Object.assign({}, ar, ...DOMAIN_DICTS.map((d) => d.ar)),
  en: Object.assign({}, en, ...DOMAIN_DICTS.map((d) => d.en)),
};
const LOCALES: readonly Locale[] = ["ar", "en"];
const DEFAULT_LOCALE: Locale = "ar";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

export function readStoredLocale(): Locale {
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage unavailable (private mode): the session stays in-memory only.
  }
}

/** Keeps `<html lang dir>` aligned with the active locale. */
export function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {
    // Replaced by the provider in app/providers.tsx.
  },
});

/** Parameter interpolation: `t("table.rows", { count: 3 })`. */
export type Params = Record<string, string | number>;

function interpolate(template: string, params?: Params): string {
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** Pure translator (used by non-hook modules and tests). */
export function translate(
  locale: Locale,
  key: string,
  params?: Params,
): string {
  const value = DICTIONARIES[locale][key] ?? DICTIONARIES.en[key] ?? key;
  return interpolate(value, params);
}

/** Hook: returns the translator bound to the active locale. */
export function useT(): (key: string, params?: Params) => string {
  const { locale } = useContext(I18nContext);
  return (key, params) => translate(locale, key, params);
}

/** Hook: active locale + setter (pages rarely need this directly). */
export function useLocale(): I18nContextValue {
  return useContext(I18nContext);
}
