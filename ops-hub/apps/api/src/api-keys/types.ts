import type { Permission } from "@ops-hub/domain";
import type { Clock } from "@ops-hub/shared";

/** The authenticated caller derived from an API key, without any secret. */
export interface ApiKeyPrincipal {
  id: string;
  tenantId: string;
  name: string;
  scopes: readonly Permission[];
}

/** Stored key as it exists in the database; never returned by the API. */
export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: readonly string[];
  ipAllowlist: readonly string[] | null;
  createdBy: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

/** Public projection returned by list endpoints: no hash, no secret. */
export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: readonly string[];
  ipAllowlist: readonly string[] | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreatedApiKey {
  summary: ApiKeySummary;
  /** Plaintext secret; the service hands it back exactly once. */
  secret: string;
}

export interface ApiKeyStore {
  create(key: ApiKeyRecord): Promise<void>;
  /** Auth lookup: no tenant context exists yet, so this is global by hash. */
  findByHash(keyHash: string): Promise<ApiKeyRecord | null>;
  getById(tenantId: string, id: string): Promise<ApiKeySummary | null>;
  list(
    tenantId: string,
    filter?: {
      limit?: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<ApiKeySummary[]>;
  /** Revokes only when not already revoked; returns whether it revoked. */
  revoke(tenantId: string, id: string, revokedAt: Date): Promise<boolean>;
}

export interface ApiKeyServiceDeps {
  store: ApiKeyStore;
  clock: Clock;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: readonly string[];
  ipAllowlist?: readonly string[] | null | undefined;
}

/** Who performed an action: a staff session or another API key. */
export type ApiKeyActor =
  { kind: "user"; id: string } | { kind: "apiKey"; id: string };
