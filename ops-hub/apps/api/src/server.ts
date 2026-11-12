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
import { PgTenantPolicyReader } from "./availability/pg-tenant-policy";
import { AvailabilityService } from "./availability/service";
import {
  PgReservationBalanceReader,
  PgReservationStore,
} from "./stock/pg-reservation-store";
import { RedisLock } from "./stock/redis-lock";
import { ReservationService } from "./stock/reservation-service";
import { AdjustmentService } from "./stock/adjustment-service";
import { PgOrderStore } from "./orders/pg-store";
import { PgOrderEventStore } from "./orders/pg-order-event-store";
import { PgExceptionStore } from "./orders/pg-exception-store";
import { PgShipmentStore } from "./shipments/pg-store";
import { ShipmentService } from "./shipments/service";
import { BostaAdapter } from "./integrations/bosta/adapter";
import { OutboundWebhookService } from "./webhooks/outbound-service";
import { ReportsService } from "./reports/service";
import { OrderService } from "./orders/service";
import { OrderValidationService } from "./orders/validation-service";
import { DuplicateDetectionService } from "./orders/duplicate-detection-service";
import { ExceptionService } from "./orders/exception-service";
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
const stockStore = new PgStockStore(pool);
const stock = new StockService({ store: stockStore, clock: systemClock });

const availability = new AvailabilityService({
  variants: new PgVariantStore(pool),
  balances: stockStore,
  policy: new PgTenantPolicyReader(pool),
});

const reservations = new ReservationService({
  store: new PgReservationStore(pool),
  balances: new PgReservationBalanceReader(pool),
  movements: stock,
  lock: new RedisLock(redis),
  clock: systemClock,
});

const adjustments = new AdjustmentService(stock);

const orderStore = new PgOrderStore(pool);
const exceptionStore = new PgExceptionStore(pool);
const duplicateDetection = new DuplicateDetectionService(
  orderStore,
  exceptionStore,
  systemClock,
);
const orders = new OrderService({
  store: orderStore,
  variants: new PgVariantStore(pool),
  duplicateDetection,
  events: new PgOrderEventStore(pool),
});
const orderValidation = new OrderValidationService({
  store: orderStore,
  exceptions: exceptionStore,
  variants: new PgVariantStore(pool),
  reservations,
  clock: systemClock,
});
const exceptions = new ExceptionService({
  store: exceptionStore,
  clock: systemClock,
});

const shipments = new ShipmentService({
  store: new PgShipmentStore(pool),
  carrier: new BostaAdapter({
    apiKey: process.env.BOSTA_API_KEY ?? "placeholder",
    baseUrl: process.env.BOSTA_BASE_URL ?? "http://localhost:4010",
    environment: "test",
  }),
  clock: systemClock,
});

const outboundWebhooks = new OutboundWebhookService(pool);
const reports = new ReportsService(pool);

const app = buildApp({
  auth,
  apiKeys,
  audit,
  auditReader: new PgAuditReader(pool),
  catalog,
  catalogImport,
  inventory,
  stock,
  availability,
  reservations,
  adjustments,
  orders,
  duplicateDetection,
  orderValidation,
  exceptions,
  shipments,
  outboundWebhooks,
  trackingPool: pool,
  reports,
});
app.addHook("onClose", async () => {
  await pool.end();
  redis.disconnect();
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ host: "0.0.0.0", port });
