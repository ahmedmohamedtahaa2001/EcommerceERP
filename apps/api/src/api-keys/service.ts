import { randomUUID } from "node:crypto";

import { PERMISSIONS, type Permission } from "@ops-hub/domain";

import { ValidationError } from "../auth/errors";
import {
  ApiKeyIpDeniedError,
  InvalidApiKeyError,
} from "./errors";
import { generateApiKey, hashApiKey } from "./keys";
import type {
  ApiKeyActor,
  ApiKeyPrincipal,
  ApiKeyServiceDeps,
  ApiKeySummary,
  CreatedApiKey,
  CreateApiKeyRequest,
} from "./types";

const MAX_NAME_LENGTH = 200;
const MAX_ALLOWLIST_ENTRIES = 32;
const MAX_IP_LENGTH = 64;
// Loose shape check for IPv4/IPv6 literals; exact-match semantics are applied
// by the allow-list comparison itself.
const IP_PATTERN = /^[0-9a-fA-F.:]{3,64}$/;

export class ApiKeyService {
  constructor(private readonly deps: ApiKeyServiceDeps) {}

  async create(
    request: CreateApiKeyRequest,
    actor: ApiKeyActor,
    tenantId: string,
  ): Promise<CreatedApiKey> {
    const name = request.name.trim();
    if (name === "" || name.length > MAX_NAME_LENGTH) {
      throw new ValidationError(
        `name must be 1-${MAX_NAME_LENGTH} characters.`,
      );
    }

    const scopes = [...new Set(request.scopes)];
    if (scopes.length === 0) {
      throw new ValidationError("at least one scope is required.");
    }
    for (const scope of scopes) {
      if (!(PERMISSIONS as readonly string[]).includes(scope)) {
        throw new ValidationError(`unknown scope: ${scope}`);
      }
    }

    let ipAllowlist: string[] | null = null;
    if (request.ipAllowlist !== undefined && request.ipAllowlist !== null) {
      ipAllowlist = [...new Set(request.ipAllowlist)];
      if (ipAllowlist.length > MAX_ALLOWLIST_ENTRIES) {
        throw new ValidationError(
          `ipAllowlist supports at most ${MAX_ALLOWLIST_ENTRIES} entries.`,
        );
      }
      for (const ip of ipAllowlist) {
        if (ip.length === 0 || ip.length > MAX_IP_LENGTH || !IP_PATTERN.test(ip)) {
          throw new ValidationError(`invalid IP address in ipAllowlist: ${ip}`);
        }
      }
    }

    const generated = generateApiKey();
    const now = this.deps.clock.now();
    const id = randomUUID();

    await this.deps.store.create({
      id,
      tenantId,
      name,
      keyHash: generated.hash,
      keyPrefix: generated.prefix,
      scopes: scopes as Permission[],
      ipAllowlist,
      createdBy: actor.kind === "user" ? actor.id : null,
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    });

    return {
      summary: {
        id,
        name,
        keyPrefix: generated.prefix,
        scopes: scopes as Permission[],
        ipAllowlist,
        createdAt: now,
        lastUsedAt: null,
        revokedAt: null,
      },
      secret: generated.secret,
    };
  }

  /**
   * Resolves a presented secret into an authenticated principal. Unknown,
   * malformed, and revoked secrets all fail with the same generic 401.
   */
  async authenticate(
    secret: string,
    clientIp: string | null,
  ): Promise<ApiKeyPrincipal> {
    const record = await this.deps.store.findByHash(hashApiKey(secret));
    if (!record || record.revokedAt !== null) {
      throw new InvalidApiKeyError();
    }

    if (record.ipAllowlist && record.ipAllowlist.length > 0) {
      if (clientIp === null || !record.ipAllowlist.includes(clientIp)) {
        throw new ApiKeyIpDeniedError();
      }
    }

    return {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      scopes: record.scopes as Permission[],
    };
  }

  async list(tenantId: string): Promise<ApiKeySummary[]> {
    return this.deps.store.list(tenantId);
  }

  /** Returns whether a key was revoked; false means it did not exist. */
  async revoke(tenantId: string, id: string): Promise<boolean> {
    return this.deps.store.revoke(tenantId, id, this.deps.clock.now());
  }
}
