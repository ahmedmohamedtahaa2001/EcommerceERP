import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export const DEFAULT_DATABASE_URL =
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";

export function createDb(connectionString = DEFAULT_DATABASE_URL) {
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}
