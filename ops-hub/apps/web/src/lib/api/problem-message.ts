import { ApiError } from "./client";
import { readStoredLocale, translate } from "../i18n";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** The code at the end of a problem type URL, e.g. `.../problems/duplicate-phone` → `duplicate-phone`. */
export function problemCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const type = error.problem.type ?? "";
  const slash = type.lastIndexOf("/");
  return slash === -1 ? null : type.slice(slash + 1) || null;
}

/**
 * A message for the person using the screen. A known error code is shown in
 * their language; otherwise English readers see the server's detail and Arabic
 * readers get undefined, so the screen falls back to its own Arabic message
 * instead of showing English text.
 */
export function describeProblem(
  error: unknown,
  t: Translate,
  locale: string,
): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.status === 0) return t("problem.network");
  const code = problemCode(error);
  if (code !== null) {
    const key = `problem.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return locale === "en" ? error.problem.detail : undefined;
}

/** `problemMessage(error, fallback)`: the error in the reader's chosen language, else the screen's own fallback. */
export function problemMessage(error: unknown, fallback: string): string {
  const locale = readStoredLocale();
  return (
    describeProblem(
      error,
      (key, params) => translate(locale, key, params),
      locale,
    ) ?? fallback
  );
}
