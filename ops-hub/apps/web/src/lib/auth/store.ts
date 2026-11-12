import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { setTokenProvider, setUnauthorizedHandler } from "../api/client";
import {
  login as loginApi,
  logout as logoutApi,
  me,
  type AuthUser,
} from "../api/auth";

/**
 * Session persistence for the Ops Hub console.
 *
 * Storage key: `ops-hub.session` → `{"token":…,"user":{…}}` (UI_PLAN §1).
 * The bearer token is injected into the API client here, and a 401 from any
 * request clears the session and returns the user to `/login`.
 */

const SESSION_KEY = "ops-hub.session";

export interface Session {
  token: string;
  user: AuthUser;
}

function readSessionFromStorage(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { token?: unknown }).token === "string"
    ) {
      return parsed as Session;
    }
    return null;
  } catch {
    return null;
  }
}

function writeSession(session: Session): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

export function getToken(): string | null {
  return readSessionFromStorage()?.token ?? null;
}

setTokenProvider(getToken);

setUnauthorizedHandler(() => {
  clearSession();
  // Already on the login page: a reload would wipe what the user typed.
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
});

export interface LoginInput {
  email: string;
  password: string;
}

export async function login(input: LoginInput): Promise<Session> {
  const response = await loginApi(input);
  const session: Session = { token: response.token, user: response.user };
  writeSession(session);
  return session;
}

export async function logout(): Promise<void> {
  clearSession();
  try {
    await logoutApi();
  } catch {
    // The session is already gone locally; the server call is best-effort.
  }
}

/** Boot validation: refreshes the stored user via `GET /v1/auth/me`. */
export async function fetchSession(): Promise<Session | null> {
  const stored = readSessionFromStorage();
  if (stored === null) {
    return null;
  }
  try {
    const response = await me();
    return { token: stored.token, user: response.user };
  } catch {
    clearSession();
    return null;
  }
}

/** React Query key for the session record. */
export const SESSION_QUERY_KEY = ["session"] as const;

/**
 * Puts a freshly created session straight into the React Query cache.
 *
 * Without this, `GET /v1/auth/me` would still be "loading" after a login
 * while `ProtectedRoute` already saw a stored token, and the two would
 * redirect against each other in a loop.
 */
export function useSetSession(): (session: Session) => void {
  const queryClient = useQueryClient();
  return (session: Session) => {
    queryClient.setQueryData(SESSION_QUERY_KEY, session);
  };
}

/**
 * Small session hook: `null` while unauthenticated, the session record once
 * validated. Loading state is exposed so protected routes can wait.
 */
export function useSession(): {
  session: Session | null;
  isLoading: boolean;
} {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  // Keep the cache coherent when the token is cleared outside React.
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === SESSION_KEY) {
        void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  return {
    session: query.data ?? null,
    isLoading: query.isLoading,
  };
}
