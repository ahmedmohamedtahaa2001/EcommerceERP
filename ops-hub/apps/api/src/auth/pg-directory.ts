import { isRole } from "@ops-hub/domain";
import type { Pool } from "pg";

import type { UserDirectory, UserRecord } from "./types";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  password_hash: string | null;
  tenant_id: string | null;
  role: string | null;
}

export class PgUserDirectory implements UserDirectory {
  constructor(private readonly pool: Pool) {}

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.find("lower(u.email) = lower($1)", email);
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.find("u.id = $1", id);
  }

  private async find(
    predicate: string,
    value: string,
  ): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      `select u.id, u.email, u.full_name, u.password_hash, m.tenant_id, m.role
         from users u
         left join lateral (
           select tenant_id, role
             from memberships
            where user_id = u.id
            order by created_at
            limit 1
         ) m on true
        where ${predicate}
        limit 1`,
      [value],
    );

    const row = result.rows[0];
    if (!row || row.password_hash === null) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      tenantId: row.tenant_id,
      role: isRole(row.role) ? row.role : null,
      passwordHash: row.password_hash,
    };
  }
}
