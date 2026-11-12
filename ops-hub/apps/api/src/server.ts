import { createDb } from "@ops-hub/db";
import Redis from "ioredis";

import { buildFullApp } from "./wiring";

const { pool } = createDb();
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
});

const app = buildFullApp(pool, redis);

app.addHook("onClose", async () => {
  await pool.end();
  redis.disconnect();
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ host: "0.0.0.0", port });
