import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useT } from "../lib/i18n";
import { Breadcrumbs, type Crumb } from "../components/ui/Breadcrumbs";
import { Sidebar } from "./Sidebar";
import { NAV_SECTIONS } from "./nav-model";
import { Topbar } from "./Topbar";

/**
 * App shell (UI_PLAN §6): dark inline-start sidebar + topbar, warm `#FAFAF8`
 * content area with `max-w` 1280, breadcrumbs above the routed page.
 * Collapses to icon-only on the sidebar toggle (kept for md+; the sidebar
 * itself is the only chrome on small screens).
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();
  const location = useLocation();

  const crumbs = crumbsFromPath(location.pathname, t);

  return (
    <div className="flex min-h-dvh bg-bg" dir="inherit">
      <Sidebar collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onToggleSidebar={() => setCollapsed((value) => !value)} />
        <main className="mx-auto w-full max-w-content flex-1 px-4 py-6 lg:px-8">
          {crumbs.length > 0 ? (
            <Breadcrumbs items={crumbs} className="mb-4" />
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * Derives breadcrumbs from the URL path using nav labels (e.g.
 * `/inventory/movements` → المخازن / حركات المخزون). Detail routes keep the
 * collection crumb and drop the raw id segment.
 */
function crumbsFromPath(path: string, t: (key: string) => string): Crumb[] {
  const segments = path.split("/").filter((segment) => segment !== "");
  const crumbs: Crumb[] = [];
  let accumulated = "";

  for (const segment of segments) {
    accumulated += `/${segment}`;
    if (segment.startsWith(":")) {
      continue;
    }
    const labelKey = findNavLabel(accumulated);
    if (labelKey !== null) {
      crumbs.push({ label: t(labelKey), to: accumulated });
    }
  }

  // A trailing segment that matched no route label is a detail id; keep the
  // previous crumb as the current page instead of showing a raw id.
  if (crumbs.length > 0) {
    const last = crumbs[crumbs.length - 1];
    if (last !== undefined) {
      crumbs[crumbs.length - 1] = { label: last.label, to: undefined };
    }
  }
  return crumbs;
}

function findNavLabel(path: string): string | null {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.to === path) {
        return item.labelKey;
      }
    }
  }
  return null;
}
