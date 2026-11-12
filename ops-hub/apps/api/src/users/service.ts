import { randomUUID } from "node:crypto";

import { withTenant } from "@ops-hub/db";
import { ROLES, type Role } from "@ops-hub/domain";
import type { Pool } from "pg";

import type { PasswordHasher } from "../auth/types";
import {
  EmailAlreadyRegisteredError,
  LastOwnerError,
  MemberNotFoundError,
  SelfChangeError,
  UserValidationError,
} from "./errors";

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;
const MAX_NAME_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNIQUE_VIOLATION = "23505";

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: Role;
  active: boolean;
  createdAt: Date;
}

interface MemberRow {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  active: boolean;
  created_at: Date;
}

function toMember(row: MemberRow): TeamMember {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role as Role,
    active: row.active,
    createdAt: row.created_at,
  };
}

function requireRole(value: unknown): Role {
  if (
    typeof value !== "string" ||
    !(ROLES as readonly string[]).includes(value)
  ) {
    throw new UserValidationError(`role must be one of: ${ROLES.join(", ")}.`);
  }
  return value as Role;
}

export class UserAdminService {
  constructor(
    private readonly pool: Pool,
    private readonly hasher: PasswordHasher,
    private readonly clock: { now(): Date },
  ) {}

  async list(tenantId: string): Promise<TeamMember[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<MemberRow>(
        `select m.id, m.user_id, u.email, u.full_name, m.role, m.active, m.created_at
           from memberships m
           join users u on u.id = m.user_id
          where m.tenant_id = $1
          order by m.created_at asc, m.id asc`,
        [tenantId],
      );
      return result.rows.map(toMember);
    });
  }

  /** Creates the account with an initial password chosen by the owner, and adds it to this business. */
  async invite(
    tenantId: string,
    input: {
      email: unknown;
      fullName?: unknown;
      role: unknown;
      password: unknown;
    },
  ): Promise<TeamMember> {
    const email =
      typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (email === "" || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      throw new UserValidationError("email must be a valid address.");
    }
    const role = requireRole(input.role);
    if (
      typeof input.password !== "string" ||
      input.password.length < MIN_PASSWORD_LENGTH ||
      input.password.length > MAX_PASSWORD_LENGTH
    ) {
      throw new UserValidationError(
        `password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
      );
    }
    const fullName =
      typeof input.fullName === "string" && input.fullName.trim() !== ""
        ? input.fullName.trim().slice(0, MAX_NAME_LENGTH)
        : null;

    const existing = await withTenant(this.pool, tenantId, (client) =>
      client.query(`select 1 from users where lower(email) = $1`, [email]),
    );
    if ((existing.rowCount ?? 0) > 0) {
      throw new EmailAlreadyRegisteredError();
    }

    const userId = randomUUID();
    const passwordHash = await this.hasher.hash(input.password);
    const now = this.clock.now();
    try {
      return await withTenant(this.pool, tenantId, async (client) => {
        await client.query(
          `insert into users (id, email, full_name, password_hash, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $5)`,
          [userId, email, fullName, passwordHash, now],
        );
        const membership = await client.query<{ id: string }>(
          `insert into memberships (tenant_id, user_id, role, active)
           values ($1, $2, $3, true) returning id`,
          [tenantId, userId, role],
        );
        return {
          id: membership.rows[0]!.id,
          userId,
          email,
          fullName,
          role,
          active: true,
          createdAt: now,
        };
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    actorUserId: string,
    membershipId: string,
    change: { role?: unknown; active?: unknown },
  ): Promise<{ before: TeamMember; after: TeamMember }> {
    const role =
      change.role === undefined ? undefined : requireRole(change.role);
    if (change.active !== undefined && typeof change.active !== "boolean") {
      throw new UserValidationError("active must be true or false.");
    }
    const active = change.active as boolean | undefined;

    return withTenant(this.pool, tenantId, async (client) => {
      const current = await client.query<MemberRow>(
        `select m.id, m.user_id, u.email, u.full_name, m.role, m.active, m.created_at
           from memberships m join users u on u.id = m.user_id
          where m.tenant_id = $1 and m.id = $2
          for update of m`,
        [tenantId, membershipId],
      );
      const row = current.rows[0];
      if (!row) throw new MemberNotFoundError();
      const before = toMember(row);

      const newRole = role ?? before.role;
      const newActive = active ?? before.active;
      const changesAccess =
        newRole !== before.role || newActive !== before.active;
      if (!changesAccess) {
        return { before, after: before };
      }
      if (row.user_id === actorUserId) {
        throw new SelfChangeError();
      }

      const losesOwnership =
        before.role === "owner" &&
        before.active &&
        (newRole !== "owner" || !newActive);
      if (losesOwnership) {
        const owners = await client.query<{ count: number }>(
          `select count(*)::int as count from memberships
            where tenant_id = $1 and role = 'owner' and active and id <> $2`,
          [tenantId, membershipId],
        );
        if (owners.rows[0]!.count === 0) {
          throw new LastOwnerError();
        }
      }

      const updated = await client.query<MemberRow>(
        `update memberships m set role = $3, active = $4
           from users u
          where m.tenant_id = $1 and m.id = $2 and u.id = m.user_id
         returning m.id, m.user_id, u.email, u.full_name, m.role, m.active, m.created_at`,
        [tenantId, membershipId, newRole, newActive],
      );
      return { before, after: toMember(updated.rows[0]!) };
    });
  }
}
