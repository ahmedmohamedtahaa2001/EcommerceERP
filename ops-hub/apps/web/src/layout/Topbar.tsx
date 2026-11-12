import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { IconButton } from "../components/ui/IconButton";
import { SearchBar } from "../components/ui/SearchBar";
import { logout, useSession } from "../lib/auth/store";
import { useLocale, useT } from "../lib/i18n";
import { BellIcon, ChevronDownIcon, LogOutIcon } from "./icons";

export interface TopbarProps {
  onToggleSidebar: () => void;
}

const PLACEHOLDER_EXCEPTION_COUNT = 3;

/** Global topbar: sidebar toggle, search, AR/EN switch, bell, user menu. */
export function Topbar({ onToggleSidebar }: TopbarProps) {
  const t = useT();
  const navigate = useNavigate();
  const { session } = useSession();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent): void => {
      if (
        menuRef.current !== null &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  const user = session?.user;
  const displayName = user?.fullName ?? user?.email ?? t("app.name");

  const handleLogout = async (): Promise<void> => {
    await logout();
    void navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200 bg-surface px-4 shadow-xs">
      <IconButton aria-label={t("action.toggleMenu")} onClick={onToggleSidebar}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </IconButton>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder={t("topbar.searchPlaceholder")}
        className="hidden max-w-md flex-1 md:block"
      />

      <div className="ms-auto flex items-center gap-1">
        <LocaleToggleButton />

        <div className="relative">
          <IconButton aria-label={t("topbar.notifications")}>
            <BellIcon />
          </IconButton>
          <Badge
            title={t("nav.exceptions")}
            className="absolute -top-0.5 end-0.5"
          >
            {PLACEHOLDER_EXCEPTION_COUNT}
          </Badge>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-pill py-1 ps-1 pe-2 hover:bg-ink-100"
          >
            <Avatar name={displayName} size="sm" />
            <span className="hidden text-body2 font-semibold text-ink-800 lg:inline">
              {displayName}
            </span>
            <ChevronDownIcon size={16} />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute end-0 top-full z-40 mt-2 w-48 rounded-lg bg-surface p-1.5 shadow-md"
            >
              <MenuButton
                icon={<LogOutIcon size={16} />}
                label={t("action.logout")}
                onSelect={() => {
                  setMenuOpen(false);
                  void handleLogout();
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function MenuButton({
  icon,
  label,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded px-3 py-2 text-start text-body2 font-semibold text-ink-800 hover:bg-ink-100"
    >
      {icon}
      {label}
    </button>
  );
}

/** AR/EN switch: toggles the locale persisted by the i18n provider. */
function LocaleToggleButton() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
      aria-label={t("topbar.localeLabel")}
      className="hidden h-10 items-center rounded-pill border border-ink-300 px-3 text-body2 font-bold text-ink-700 hover:bg-ink-100 sm:inline-flex"
    >
      {locale === "ar" ? "EN" : "ع"}
    </button>
  );
}
