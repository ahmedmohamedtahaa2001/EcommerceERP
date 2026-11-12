import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { PlaybookService } from "../playbooks/service";
import { SandboxService, SafetyGuard } from "../platform/service";

export interface Phase4Services {
  playbooks: PlaybookService;
  sandbox: SandboxService;
  safety: SafetyGuard;
}

export function registerPhase4Routes(
  app: FastifyInstance,
  options: {
    services: Phase4Services;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
    /** The tenant that is treated as the sandbox. */
    sandboxTenantId?: string;
  },
): void {
  const { services, requestAuth, audit, sandboxTenantId } = options;
  const { playbooks, sandbox, safety } = services;

  const tenantOf = (request: Parameters<typeof requirePrincipal>[0]) =>
    actorAndTenant(requirePrincipal(request)).tenantId;

  // ---- Playbooks -----------------------------------------------------------

  app.post(
    "/v1/playbooks/morning-report",
    { preHandler: requirePermission(requestAuth, "reports:read") },
    async (request) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const date = body.date ? new Date(String(body.date)) : new Date();
      const result = await playbooks.morningReport(
        tenantId,
        Number.isNaN(date.getTime()) ? new Date() : date,
      );
      await recordAudit(request, audit, {
        action: "playbook.morning_report",
        objectType: "playbook",
        objectId: "morning_report",
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/playbooks/exception-triage",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const tenantId = tenantOf(request);
      const result = await playbooks.exceptionTriage(tenantId);
      await recordAudit(request, audit, {
        action: "playbook.exception_triage",
        objectType: "playbook",
        objectId: "exception_triage",
        after: result,
      });
      return result;
    },
  );

  app.post(
    "/v1/playbooks/settlement-analysis",
    { preHandler: requirePermission(requestAuth, "reports:read") },
    async (request) => {
      const tenantId = tenantOf(request);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await playbooks.settlementAnalysis(
        tenantId,
        String(body.fileId ?? ""),
      );
      await recordAudit(request, audit, {
        action: "playbook.settlement_analysis",
        objectType: "playbook",
        objectId: "settlement_analysis",
        after: result,
      });
      return result;
    },
  );

  // ---- Sandbox -------------------------------------------------------------

  app.post(
    "/v1/sandbox/reset",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const tenantId = sandboxTenantId ?? tenantOf(request);
      const result = await sandbox.reset(tenantId);
      await recordAudit(request, audit, {
        action: "sandbox.reset",
        objectType: "tenant",
        objectId: tenantId,
        after: result,
      });
      return { tenantId, ...result };
    },
  );

  // ---- Agent safety preview -----------------------------------------------

  app.post(
    "/v1/safety/check",
    { preHandler: requirePermission(requestAuth, "settings:write") },
    async (request) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const decision = safety.check({
        keyId: String(body.keyId ?? ""),
        action: String(body.action ?? ""),
        ...(body.amountMinor !== undefined
          ? { amountMinor: Number(body.amountMinor) }
          : {}),
        ...(body.dryRun !== undefined ? { dryRun: body.dryRun === true } : {}),
      });
      await recordAudit(request, audit, {
        action: "safety.checked",
        objectType: "safety_decision",
        objectId: String(body.keyId ?? ""),
        after: decision,
      });
      return decision;
    },
  );
}
