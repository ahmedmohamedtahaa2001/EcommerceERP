export type AuditActorType = "user" | "api_key" | "system";

/** One append-only audit entry; matches the audit_log columns. */
export interface AuditEntryInput {
  tenantId: string;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  before?: unknown;
  after?: unknown;
}

export interface AuditEntryRecord {
  id: number;
  tenantId: string;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

export interface AuditQuery {
  objectType?: string;
  objectId?: string;
  limit: number;
}

export interface AuditWriter {
  record(entry: AuditEntryInput): Promise<void>;
}

export interface AuditReader {
  list(tenantId: string, query: AuditQuery): Promise<AuditEntryRecord[]>;
}

export const AUDIT_MAX_LIMIT = 200;
export const AUDIT_DEFAULT_LIMIT = 50;
