import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ToastProvider } from "../components/ui/Toast";
import {
  I18nContext,
  applyDocumentLocale,
  readStoredLocale,
  storeLocale,
  type Locale,
} from "../lib/i18n";

export interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Root providers: TanStack Query (server state), toasts, and the locale
 * context that keeps `documentElement.lang/dir` and `ops-hub.locale` in
 * sync (UI_PLAN §1/§3).
 */
export function AppProviders({ children }: AppProvidersProps) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const setLocale = (next: Locale): void => {
    setLocaleState(next);
    storeLocale(next);
  };

  const i18nValue = useMemo(() => ({ locale, setLocale }), [locale]);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Ops console: stale after 30s, one quiet retry, no refetch on
            // window focus (users keep the tab open while working).
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nContext.Provider value={i18nValue}>
        <ToastProvider>{children}</ToastProvider>
      </I18nContext.Provider>
    </QueryClientProvider>
  );
}
