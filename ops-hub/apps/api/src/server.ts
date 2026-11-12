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
import { ReceivingService } from "./receiving/service";
import { CodService } from "./risk/service";
import { ReturnsService } from "./returns/service";
import { SettlementService, csvSettlementParser } from "./settlements/service";
import { DlqService } from "./dlq/service";
import { RoutingService } from "./routing/service";
import { SourcingService } from "./suppliers/service";
import { ScorecardService } from "./scorecards/service";
import { InboxService } from "./inbox/service";
import { CrmService } from "./crm/service";
import { PlaybookService } from "./playbooks/service";
import {
  NotificationService,
  SmtpSender,
  WhatsAppStubSender,
} from "./notifications/service";
import { ConnectorHealthService } from "./integrations/connectors/health";
import {
  SandboxService,
  SafetyGuard,
  RedisRateLimitStore,
} from "./platform/service";
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

const receiving = new ReceivingService({
  pool,
  stock,
  store: stockStore,
  clock: systemClock,
});
const cod = new CodService({ pool, clock: systemClock });
const returns = new ReturnsService({
  pool,
  stock,
  clock: systemClock,
  refundApprovalThresholdMinor: Number(
    process.env.REFUND_APPROVAL_THRESHOLD_MINOR ?? 100000,
  ),
});
const settlements = new SettlementService({
  pool,
  clock: systemClock,
  parsers: [
    csvSettlementParser("bosta"),
    csvSettlementParser("posta"),
    csvSettlementParser("jt"),
  ],
});
const dlq = new DlqService({ pool, clock: systemClock });
const routing = new RoutingService(pool);
const sourcing = new SourcingService({
  pool,
  clock: systemClock,
  approvalThresholdMinor: Number(
    process.env.PO_APPROVAL_THRESHOLD_MINOR ?? 500000,
  ),
});
const scorecards = new ScorecardService({ pool, clock: systemClock });
const inbox = new InboxService({ pool, clock: systemClock });
const crm = new CrmService({ pool, clock: systemClock });
const playbooks = new PlaybookService({ pool, clock: systemClock });
const sandbox = new SandboxService({ pool });
const notifications = new NotificationService({
  pool,
  clock: systemClock,
  senders: [
    new SmtpSender({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      from: process.env.SMTP_FROM ?? "ops-hub@localhost",
    }),
    new WhatsAppStubSender(),
  ],
});
const connectors = new ConnectorHealthService({ pool, clock: systemClock });
const safety = new SafetyGuard({
  approvalThresholdMinor: Number(
    process.env.APPROVAL_THRESHOLD_MINOR ?? 100000,
  ),
  volumeCapPerHour: Number(process.env.VOLUME_CAP_PER_HOUR ?? 1000),
});

const app = buildApp({
  rateLimit: {
    store: new RedisRateLimitStore(redis),
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 600),
    windowSeconds: 60,
  },
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
  phase2: { receiving, cod, returns, settlements, dlq, routing },
  phase3: { sourcing, scorecards, inbox, crm },
  phase4: { playbooks, sandbox, safety },
  notifications,
  connectors,
  ...(process.env.SANDBOX_TENANT_ID !== undefined
    ? { sandboxTenantId: process.env.SANDBOX_TENANT_ID }
    : {}),
});
app.addHook("onClose", async () => {
  await pool.end();
  redis.disconnect();
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ host: "0.0.0.0", port });
