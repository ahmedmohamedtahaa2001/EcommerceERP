import { Client } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";

const client = new Client({ connectionString: databaseUrl });
await client.connect();
await client.query("drop schema if exists public cascade");
await client.query("drop schema if exists drizzle cascade");
await client.query("create schema public");
await client.end();

console.log(
  "public and drizzle schemas dropped; run `pnpm db:migrate` to reapply",
);
