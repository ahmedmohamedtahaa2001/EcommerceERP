import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../lib/i18n";
import { IconButton } from "./IconButton";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode | undefined;
}

/**
 * Side panel anchored to the inline-end edge (left in RTL, right in LTR)
 * via logical properties. Esc closes; focus moves to the close button.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: DrawerProps) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-ink-900/70"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 p-4">
          <h2 className="text-heading6 font-bold text-ink-900">{title}</h2>
          <IconButton
            aria-label={t("action.close")}
            onClick={onClose}
            ref={closeRef}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-body2 text-ink-700">
          {children}
        </div>
        {footer !== undefined ? (
          <div className="flex justify-end gap-2 border-t border-ink-200 p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
