import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export interface Crumb {
  label: string;
  to?: string | undefined;
}

export interface BreadcrumbsProps {
  items: readonly Crumb[];
  className?: string;
}

/** aria-labelled breadcrumb nav; separator flips with direction via RTL-safe SVG. */
export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-body2 text-ink-600 ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-1"
            >
              {item.to !== undefined && !isLast ? (
                <Link to={item.to} className="text-info hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="font-semibold text-ink-700"
                >
                  {item.label}
                </span>
              )}
              {isLast ? null : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-ink-400 rtl:-scale-x-100"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Page-level header block used on every page (UI_PLAN §6). */
export interface PageHeaderProps {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <header
      className={`flex flex-wrap items-start justify-between gap-3 ${className}`}
    >
      <div>
        <h1 className="text-heading5 font-bold text-ink-900">{title}</h1>
        {description !== undefined ? (
          <p className="mt-1 max-w-2xl text-body2 text-ink-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions !== undefined ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
