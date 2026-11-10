import Redis from "ioredis";
import { Client } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const postgres = new Client({ connectionString: databaseUrl });
await postgres.connect();
const result = await postgres.query<{ version: string }>(
  "select current_setting('server_version') as version",
);
await postgres.end();

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});
await redis.connect();
const pong = await redis.ping();
redis.disconnect();

const version = result.rows[0]?.version ?? "unknown";
console.log(`postgres: ok (server ${version})`);
console.log(`redis: ${pong.toLowerCase()}`);
