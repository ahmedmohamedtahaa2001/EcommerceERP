import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: number;
  variant: ToastVariant;
  message: string;
}

export interface ToastApi {
  showToast: (variant: ToastVariant, message: string) => void;
}

const ToastContext = createContext<ToastApi>({
  showToast: () => {
    // Replaced by ToastProvider.
  },
});

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "bg-success text-white",
  error: "bg-alert text-white",
  info: "bg-ink-800 text-white",
  warning: "bg-warning text-ink-900",
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: "M20 6 9 17l-5-5",
  error: "M18 6 6 18M6 6l12 12",
  info: "M12 8h.01M12 12v5",
  warning: "M12 9v4M12 17h.01",
};

const AUTO_DISMISS_MS = 4000;

/** Toast notifications with auto-dismiss; renders a polite live region. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((variant: ToastVariant, message: string) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [...current, { id, variant, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const api = useMemo<ToastApi>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 start-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-testid="toast"
            className={`pointer-events-auto flex items-center gap-2 rounded-pill px-4 py-2 text-body2 font-semibold shadow-md ${VARIANT_CLASSES[toast.variant]}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={VARIANT_ICONS[toast.variant]} />
            </svg>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
