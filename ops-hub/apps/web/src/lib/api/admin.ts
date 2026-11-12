import { apiFetch } from "./client";
import { fetchAllPages } from "./pages";

/**
 * Wire shapes for `/v1/audit` and `/v1/api-keys*`, matching
 * `apps/api/src/audit/{types,routes}.ts` and
 * `apps/api/src/api-keys/{types,routes}.ts`. Dates arrive as ISO strings.
 */

export type AuditActorType = "user" | "api_key" | "system";

/** Matches `AuditEntryRecord` in apps/api/src/audit/types.ts. */
export interface AuditEntry {
  id: number;
  tenantId: string;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  /** Arbitrary JSON snapshots; render with care (may be redacted server-side). */
  before: unknown;
  after: unknown;
  createdAt: string;
}

/** Matches `ApiKeySummary` in apps/api/src/api-keys/types.ts. */
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  ipAllowlist: string[] | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** `POST /v1/api-keys` → 201 — `secret` is returned exactly once. */
export interface CreatedApiKey extends ApiKey {
  secret: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  ipAllowlist?: string[];
}

/**
 * `GET /v1/audit?object=type:id&objectId&limit` → 200.
 * `limit` defaults to 50 server-side, max 200.
 */
export function listAudit(params: {
  objectType?: string;
  objectId?: string;
  limit?: number;
}): Promise<{ entries: AuditEntry[] }> {
  return apiFetch<{ entries: AuditEntry[] }>("/v1/audit", {
    searchParams: {
      object:
        params.objectType && params.objectId
          ? `${params.objectType}:${params.objectId}`
          : params.objectType,
      objectId: params.objectId,
      limit: params.limit,
    },
  });
}

/** `GET /v1/api-keys` → 200. */
export async function listApiKeys(): Promise<{ keys: ApiKey[] }> {
  const keys = await fetchAllPages("keys", (page) =>
    apiFetch<{ keys: ApiKey[]; nextCursor: string | null }>("/v1/api-keys", {
      searchParams: page,
    }),
  );
  return { keys };
}

/** `POST /v1/api-keys` → 201. */
export function createApiKey(
  body: CreateApiKeyRequest,
): Promise<CreatedApiKey> {
  return apiFetch<CreatedApiKey>("/v1/api-keys", { method: "POST", body });
}

/** `DELETE /v1/api-keys/:id` → 204. */
export function revokeApiKey(id: string): Promise<void> {
  return apiFetch<void>(`/v1/api-keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
