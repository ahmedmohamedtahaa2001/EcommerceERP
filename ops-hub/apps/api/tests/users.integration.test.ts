import { randomUUID } from "node:crypto";

import { systemClock } from "@ops-hub/shared";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { argon2Hasher } from "../src/auth/passwords";
import { PgUserDirectory } from "../src/auth/pg-directory";
import { AuthService } from "../src/auth/service";
import { InvalidCredentialsError, UnauthorizedError } from "../src/auth/errors";
import { SESSION_TTL_SECONDS } from "../src/auth/types";
import { RedisSessionStore } from "../src/auth/redis-session-store";
import {
  EmailAlreadyRegisteredError,
  LastOwnerError,
  MemberNotFoundError,
  SelfChangeError,
  UserValidationError,
} from "../src/users/errors";
import { UserAdminService } from "../src/users/service";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";

const tenantId = "00000000-0000-4000-8000-00000000f101";
const otherTenantId = "00000000-0000-4000-8000-00000000f102";
const OWNER_PASSWORD = "owner-password-123";
const MANAGER_PASSWORD = "manager-password-123";

const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });
const admin = new UserAdminService(pool, argon2Hasher, systemClock);

/** In-memory sessions: the login/logout path is what matters here, not the Redis backend. */
const sessionsMap = new Map<
  string,
  { userId: string; tenantId: string | null; expiresAt: Date }
>();
const sessions = {
  async create(session: {
    token: string;
    userId: string;
    tenantId: string | null;
    expiresAt: Date;
  }) {
    sessionsMap.set(session.token, session);
  },
  async get(token: string) {
    return sessionsMap.get(token) ?? null;
  },
  async delete(token: string) {
    sessionsMap.delete(token);
  },
} as unknown as RedisSessionStore;

const auth = new AuthService({
  users: new PgUserDirectory(pool),
  passwords: argon2Hasher,
  sessions,
  limiter: {
    blockedFor: async () => 0,
    recordFailure: async () => undefined,
    reset: async () => undefined,
  },
  clock: systemClock,
  sessionTtlSeconds: SESSION_TTL_SECONDS,
});

async function seedOwner(
  id: string,
  email: string,
  password: string,
  role = "owner",
) {
  const hash = await argon2Hasher.hash(password);
  await client.query(
    `insert into users (id, email, full_name, password_hash) values ($1, $2, 'Seed', $3)`,
    [id, email, hash],
  );
  await client.query(
    `insert into memberships (tenant_id, user_id, role, active) values ($1, $2, $3, true)`,
    [tenantId, id, role],
  );
}

describe.skipIf(!runDbTests)("Team management against Postgres", () => {
  let ownerId: string;
  let ownerMembership: string;

  beforeAll(async () => {
    await client.connect();
    await client.query("delete from memberships where tenant_id in ($1, $2)", [
      tenantId,
      otherTenantId,
    ]);
    await client.query(
      "delete from users where email like 'team-%@example.com'",
    );
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantId,
      otherTenantId,
    ]);
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'team-test', 'Team Test')",
      [tenantId],
    );
    await client.query(
      "insert into tenants (id, slug, name) values ($1, 'team-other', 'Team Other')",
      [otherTenantId],
    );
    ownerId = randomUUID();
    await seedOwner(ownerId, "team-owner@example.com", OWNER_PASSWORD);
    const row = await client.query<{ id: string }>(
      `select id from memberships where tenant_id = $1 and user_id = $2`,
      [tenantId, ownerId],
    );
    ownerMembership = row.rows[0]!.id;
  });

  afterAll(async () => {
    await client.query("delete from memberships where tenant_id in ($1, $2)", [
      tenantId,
      otherTenantId,
    ]);
    await client.query(
      "delete from users where email like 'team-%@example.com'",
    );
    await client.query("delete from tenants where id in ($1, $2)", [
      tenantId,
      otherTenantId,
    ]);
    await client.end();
    await pool.end();
  });

  it("adds a member with an initial password, who can then log in with the owner's chosen password", async () => {
    const member = await admin.invite(tenantId, {
      email: "  Team-Manager@Example.COM ",
      fullName: "Mona",
      role: "manager",
      password: MANAGER_PASSWORD,
    });
    expect(member).toMatchObject({
      email: "team-manager@example.com",
      role: "manager",
      active: true,
    });

    const login = await auth.login(
      "team-manager@example.com",
      MANAGER_PASSWORD,
    );
    expect(login.user.role).toBe("manager");
    expect(login.user.tenantId).toBe(tenantId);
  });

  it("lists only this business's members", async () => {
    const members = await admin.list(tenantId);
    expect(members.map((m) => m.email).sort()).toEqual([
      "team-manager@example.com",
      "team-owner@example.com",
    ]);
    expect(await admin.list(otherTenantId)).toEqual([]);
  });

  it("refuses an email that already has an account, a short password, and an unknown role", async () => {
    await expect(
      admin.invite(tenantId, {
        email: "team-owner@example.com",
        role: "viewer",
        password: "another-long-password",
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    await expect(
      admin.invite(tenantId, {
        email: "team-short@example.com",
        role: "viewer",
        password: "short",
      }),
    ).rejects.toBeInstanceOf(UserValidationError);
    await expect(
      admin.invite(tenantId, {
        email: "team-role@example.com",
        role: "superuser",
        password: "long-enough-password",
      }),
    ).rejects.toBeInstanceOf(UserValidationError);
  });

  it("deactivating a member stops their login and existing sessions at once; reactivating restores them", async () => {
    const memberRow = await client.query<{ id: string }>(
      `select m.id from memberships m join users u on u.id = m.user_id
        where m.tenant_id = $1 and u.email = 'team-manager@example.com'`,
      [tenantId],
    );
    const membershipId = memberRow.rows[0]!.id;
    const { token } = await auth.login(
      "team-manager@example.com",
      MANAGER_PASSWORD,
    );
    await expect(auth.authenticate(token)).resolves.toMatchObject({
      role: "manager",
    });

    const { after } = await admin.update(tenantId, ownerId, membershipId, {
      active: false,
    });
    expect(after.active).toBe(false);

    await expect(
      auth.login("team-manager@example.com", MANAGER_PASSWORD),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(auth.authenticate(token)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    await admin.update(tenantId, ownerId, membershipId, { active: true });
    await expect(
      auth.login("team-manager@example.com", MANAGER_PASSWORD),
    ).resolves.toBeDefined();
  });

  it("refuses to change your own role or deactivate yourself", async () => {
    await expect(
      admin.update(tenantId, ownerId, ownerMembership, { active: false }),
    ).rejects.toBeInstanceOf(SelfChangeError);
    await expect(
      admin.update(tenantId, ownerId, ownerMembership, { role: "viewer" }),
    ).rejects.toBeInstanceOf(SelfChangeError);
  });

  it("keeps at least one active owner", async () => {
    const second = await admin.invite(tenantId, {
      email: "team-second-owner@example.com",
      role: "owner",
      password: "second-owner-password",
    });
    expect(second.role).toBe("owner");

    // The second owner demotes the first: allowed, since they remain the owner.
    await admin.update(tenantId, second.userId, ownerMembership, {
      role: "manager",
    });

    // Now the second owner is the only active owner; a third party cannot remove them.
    await expect(
      admin.update(tenantId, randomUUID(), second.id, { role: "manager" }),
    ).rejects.toBeInstanceOf(LastOwnerError);
  });

  it("reports an unknown member, including one from another business", async () => {
    await expect(
      admin.update(tenantId, randomUUID(), randomUUID(), { active: false }),
    ).rejects.toBeInstanceOf(MemberNotFoundError);
    await expect(
      admin.update(otherTenantId, randomUUID(), ownerMembership, {
        active: false,
      }),
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });
});
