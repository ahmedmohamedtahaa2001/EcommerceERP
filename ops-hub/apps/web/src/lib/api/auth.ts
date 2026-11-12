import { apiFetch } from "./client";

/**
 * Wire shapes for `/v1/auth/*`, matching `apps/api/src/auth/*`.
 * Over JSON, dates arrive as ISO strings.
 */

/** Matches `AuthUser` in apps/api/src/auth/types.ts. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  tenantId: string | null;
  /** One of the `ROLES` in @ops-hub/domain (owner, manager, sales_agent, …). */
  role: string | null;
  /** Every permission the role grants. Absent on sessions saved before this field existed. */
  permissions?: string[];
}

/** `POST /v1/auth/login` → 200. */
export interface LoginResponse {
  token: string;
  /** ISO instant of the session expiry (8h TTL server-side). */
  expiresAt: string;
  user: AuthUser;
}

/** `GET /v1/auth/me` → 200. */
export interface MeResponse {
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export function login(body: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/v1/auth/login", {
    method: "POST",
    body,
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/v1/auth/logout", { method: "POST" });
}

export function me(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/v1/auth/me");
}
