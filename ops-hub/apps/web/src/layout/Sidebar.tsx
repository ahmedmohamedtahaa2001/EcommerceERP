import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

import { useT } from "../lib/i18n";
import {
  AlertTriangleIcon,
  ArrowLeftRightIcon,
  BarChartIcon,
  BookmarkIcon,
  BotIcon,
  BoxesIcon,
  ClipboardEditIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LeafLogo,
  MapPinIcon,
  PackageIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShoppingCartIcon,
  UploadIcon,
  DownloadIcon,
  UsersIcon,
} from "./icons";
import type { NavIconKey } from "./nav-model";
import { NAV_SECTIONS, visibleNavSections } from "./nav-model";
import { useSession } from "../lib/auth/store";

const ICONS: Record<NavIconKey, ReactNode> = {
  dashboard: <LayoutDashboardIcon />,
  cart: <ShoppingCartIcon />,
  alert: <AlertTriangleIcon />,
  boxes: <BoxesIcon />,
  swap: <ArrowLeftRightIcon />,
  clipboard: <ClipboardEditIcon />,
  bookmark: <BookmarkIcon />,
  pin: <MapPinIcon />,
  package: <PackageIcon />,
  upload: <UploadIcon />,
  download: <DownloadIcon />,
  users: <UsersIcon />,
  chart: <BarChartIcon />,
  scroll: <ScrollTextIcon />,
  key: <KeyRoundIcon />,
  settings: <SettingsIcon />,
  bot: <BotIcon />,
};

export interface SidebarProps {
  collapsed: boolean;
}

const ACTIVE_CLASSES = "bg-primary-lightest/20 text-white font-bold shadow-sm";
const GOLD_INDICATOR =
  "before:absolute before:inset-y-1 before:start-0 before:w-1 before:rounded-e-pill before:bg-secondary";

/**
 * Dark `#003520` sidebar (UI_PLAN §6). Sits on the inline-start side — as
 * the first flex child it is right-hand in RTL and left-hand in LTR without
 * any directional classes. Active items get a translucent primary-lightest
 * pill with a gold indicator bar at the inline-start edge.
 */
export function Sidebar({ collapsed }: SidebarProps) {
  const t = useT();
  const { session } = useSession();
  const sections = visibleNavSections(
    NAV_SECTIONS,
    session?.user.permissions ?? [],
  );

  return (
    <aside
      className={`flex h-dvh shrink-0 flex-col bg-primary-darkest text-white transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-16 items-center gap-2 px-4">
        <LeafLogo size={26} className="shrink-0 text-secondary" />
        {collapsed ? null : (
          <span className="text-subtitle2 font-extrabold tracking-tight">
            {t("app.name")}
          </span>
        )}
      </div>

      <nav
        aria-label={t("app.name")}
        className="flex-1 overflow-y-auto px-2 pb-6"
      >
        {sections.map((section) => (
          <div key={section.labelKey} className="mt-4 first:mt-2">
            {collapsed ? (
              <div
                className="mx-2 my-2 border-t border-white/10"
                aria-hidden="true"
              />
            ) : (
              <p className="px-3 pb-1 text-caption font-bold uppercase tracking-wide text-white/40">
                {t(section.labelKey)}
              </p>
            )}
            <ul role="list" className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-body2 transition-colors before:absolute before:inset-y-1 before:start-0 before:w-1 before:rounded-e-pill before:bg-secondary before:transition-opacity ${
                        isActive
                          ? `${ACTIVE_CLASSES} ${GOLD_INDICATOR}`
                          : "text-white/70 hover:bg-white/10 hover:text-white before:opacity-0"
                      } ${collapsed ? "justify-center px-0" : ""}`
                    }
                  >
                    <span className="shrink-0">{ICONS[item.icon]}</span>
                    {collapsed ? null : <span>{t(item.labelKey)}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
