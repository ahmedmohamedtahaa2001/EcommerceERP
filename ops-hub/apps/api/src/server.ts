import { createDb } from "@ops-hub/db";
import { systemClock } from "@ops-hub/shared";
import Redis from "ioredis";

import { buildApp } from "./app";
import { PgApiKeyStore } from "./api-keys/pg-store";
import { ApiKeyService } from "./api-keys/service";
import { PgAuditReader, PgAuditWriter } from "./audit/pg";
import { CatalogImportService } from "./catalog/import-service";
import { PgProductStore, PgVariantStore } from "./catalog/pg-store";
import { CatalogService } from "./catalog/service";
import { PgBinStore, PgLocationStore } from "./inventory/pg-store";
import { InventoryService } from "./inventory/service";
import { PgStockStore } from "./stock/pg-store";
import { StockService } from "./stock/service";
import { argon2Hasher } from "./auth/passwords";
import { PgUserDirectory } from "./auth/pg-directory";
import { RedisRateLimiter } from "./auth/redis-rate-limiter";
import { RedisSessionStore } from "./auth/redis-session-store";
import { AuthService } from "./auth/service";
import {
  LOGIN_ATTEMPT_LIMIT,
  LOGIN_WINDOW_SECONDS,
  SESSION_TTL_SECONDS,
} from "./auth/types";

const { pool } = createDb();
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
});

const auth = new AuthService({
  users: new PgUserDirectory(pool),
  passwords: argon2Hasher,
  sessions: new RedisSessionStore(redis),
  limiter: new RedisRateLimiter(
    redis,
    LOGIN_ATTEMPT_LIMIT,
    LOGIN_WINDOW_SECONDS,
  ),
  clock: systemClock,
  sessionTtlSeconds: SESSION_TTL_SECONDS,
});

const apiKeys = new ApiKeyService({
  store: new PgApiKeyStore(pool),
  clock: systemClock,
});
const audit = new PgAuditWriter(pool);

const catalog = new CatalogService({
  products: new PgProductStore(pool),
  variants: new PgVariantStore(pool),
  clock: systemClock,
});
const catalogImport = new CatalogImportService(pool);

const inventory = new InventoryService({
  locations: new PgLocationStore(pool),
  bins: new PgBinStore(pool),
  clock: systemClock,
});
const stock = new StockService({
  store: new PgStockStore(pool),
  clock: systemClock,
});

const app = buildApp({
  auth,
  apiKeys,
  audit,
  auditReader: new PgAuditReader(pool),
  catalog,
  catalogImport,
  inventory,
  stock,
});
app.addHook("onClose", async () => {
  await pool.end();
  redis.disconnect();
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ host: "0.0.0.0", port });
