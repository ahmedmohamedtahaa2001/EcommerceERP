import { Link } from "react-router-dom";

import { useT } from "../../lib/i18n";

/**
 * Friendly 404 in the Flora look. Renders inside the app shell (route "*"
 * is a shell child). i18n keys live in `pages/auth/i18n.ts` (notFound.*)
 * because `pages/system/` carries no dictionary file.
 */
export function NotFoundPage() {
  const t = useT();

  return (
    <main
      aria-label={t("notFound.ariaLabel")}
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16 text-center"
    >
      {/* Decorative botanical 404 mark — pure SVG, Flora greens/gold */}
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="48" cy="48" r="44" fill="var(--flora-primary-lightest)" />
        <circle
          cx="48"
          cy="48"
          r="44"
          stroke="var(--flora-primary)"
          strokeOpacity="0.2"
          strokeWidth="2"
        />
        <text
          x="48"
          y="58"
          textAnchor="middle"
          fill="var(--flora-primary-dark)"
          fontSize="30"
          fontWeight="800"
          fontFamily="Nunito Sans, Cairo, sans-serif"
        >
          404
        </text>
        <path
          d="M78 14c-8 1.5-12.5 6.5-13 13 6.5-.5 11.5-5 13-13Z"
          fill="var(--flora-secondary-light)"
        />
      </svg>

      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-heading4 font-extrabold text-ink-900">
          {t("notFound.title")}
        </h1>
        <p className="text-body1 text-ink-600">{t("notFound.description")}</p>
      </div>

      {/* Link styled after the outlined Button (Link can't nest in <button>) */}
      <Link
        to="/"
        className="inline-flex h-11 items-center justify-center rounded border border-ink-300 bg-surface px-4 text-body1 font-semibold text-ink-800 transition-colors hover:bg-ink-100"
      >
        {t("notFound.cta")}
      </Link>
    </main>
  );
}
