import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useSession } from "../lib/auth/store";
import { useT } from "../lib/i18n";
import { LeafLogo } from "./icons";

export interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Gate for every route inside the shell: renders a boot splash while the
 * session query resolves, redirects to `/login` (replacing history) when
 * there is no stored token or `GET /v1/auth/me` came back 401.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, isLoading } = useSession();
  const t = useT();

  if (isLoading) {
    return (
      <div
        className="flex h-dvh flex-col items-center justify-center gap-3 bg-bg"
        role="status"
      >
        <LeafLogo size={40} className="text-primary" />
        <p className="text-body2 font-semibold text-ink-600">
          {t("state.loading")}
        </p>
      </div>
    );
  }

  if (session === null) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
