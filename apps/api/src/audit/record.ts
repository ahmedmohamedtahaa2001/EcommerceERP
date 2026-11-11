import type { FastifyRequest } from "fastify";

import { actorAndTenant, requirePrincipal } from "../auth/context";
import type { AuditActorType, AuditWriter } from "./types";

export interface AuditDetail {
  action: string;
  objectType: string;
  objectId: string | null;
  before?: unknown;
  after?: unknown;
}

/** Who acted and within which tenant; derived from the principal by default. */
export interface AuditContext {
  tenantId: string;
  actorType: AuditActorType;
  actorId: string | null;
}

/**
 * The single entry point every mutating route calls. Appends one audit
 * entry describing actor, action, object, and before/after state.
 * Secrets and hashes must never be placed into `before`/`after`.
 *
 * Routes without an authenticated principal (e.g. login) pass an explicit
 * `context`; everyone else derives it from the resolved principal.
 */
export async function recordAudit(
  request: FastifyRequest,
  writer: AuditWriter,
  detail: AuditDetail,
  context?: AuditContext,
): Promise<void> {
  const resolved =
    context ??
    (() => {
      const { actor, tenantId } = actorAndTenant(requirePrincipal(request));
      return {
        tenantId,
        actorType: actor.kind === "user" ? ("user" as const) : ("api_key" as const),
        actorId: actor.id,
      };
    })();

  const entry = {
    tenantId: resolved.tenantId,
    actorType: resolved.actorType,
    actorId: resolved.actorId,
    action: detail.action,
    objectType: detail.objectType,
    objectId: detail.objectId,
  };

  await writer.record({
    ...entry,
    ...("before" in detail ? { before: detail.before } : {}),
    ...("after" in detail ? { after: detail.after } : {}),
  });
}
