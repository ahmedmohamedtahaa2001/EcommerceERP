import type { Pool } from "pg";
import Redis from "ioredis";

import type { FastifyInstance } from "fastify";

import { buildApp, type BuildAppOptions } from "./app";
import { ApiKeyService } from "./api-keys/service";
import { PgApiKeyStore } from "./api-keys/pg-store";
import { AuthService } from "./auth/service";
import { PgUserDirectory } from "./auth/pg-directory";
import { argon2Hasher } from "./auth/passwords";
import { RedisRateLimiter } from "./auth/redis-rate-limiter";
import { RedisSessionStore } from "./auth/redis-session-store";
import {
  LOGIN_ATTEMPT_LIMIT,
  LOGIN_WINDOW_SECONDS,
  SESSION_TTL_SECONDS,
} from "./auth/types";
import { PgAuditReader, PgAuditWriter } from "./audit/pg";
import { StarterAutomationService } from "./automations/starter";
import { CatalogImportService } from "./catalog/import-service";
import { PgProductStore, PgVariantStore } from "./catalog/pg-store";
import { CatalogService } from "./catalog/service";
import { CodService } from "./risk/service";
import { CrmService } from "./crm/service";
import {
  ExchangeService,
  ReconcilerService,
  RiskGateService,
} from "./phase2/extra-services";
import { DlqService } from "./dlq/service";
import { AvailabilityService } from "./availability/service";
import { PgTenantPolicyReader } from "./availability/pg-tenant-policy";
import { ConnectorHealthService } from "./integrations/connectors/health";
import { BostaAdapter } from "./integrations/bosta/adapter";
import { ExceptionService } from "./orders/exception-service";
import { DuplicateDetectionService } from "./orders/duplicate-detection-service";
import { PgExceptionStore } from "./orders/pg-exception-store";
import { PgOrderEventStore } from "./orders/pg-order-event-store";
import { PgOrderStore } from "./orders/pg-store";
import { OrderService } from "./orders/service";
import { OrderValidationService } from "./orders/validation-service";
import { InventoryService } from "./inventory/service";
import { PgBinStore, PgLocationStore } from "./inventory/pg-store";
import { KpiService } from "./kpis/service";
import {
  NotificationService,
  SmtpSender,
  WhatsAppStubSender,
} from "./notifications/service";
import {
  PgReservationBalanceReader,
  PgReservationStore,
} from "./stock/pg-reservation-store";
import { PgStockStore } from "./stock/pg-store";
import { RedisLock } from "./stock/redis-lock";
import { AdjustmentService } from "./stock/adjustment-service";
import { ReservationService } from "./stock/reservation-service";
import { StockService } from "./stock/service";
import type { OrderEventStore } from "./orders/types";
import { CycleCountGenerator as CycleCounts } from "./phase2/extra-services";
import { PlaybookService } from "./playbooks/service";
import { SandboxService, SafetyGuard } from "./platform/service";
import { ReportsService } from "./reports/service";
import { ReceivingService } from "./receiving/service";
import { ReturnsService } from "./returns/service";
import { RoutingService } from "./routing/service";
import { ScorecardService } from "./scorecards/service";
import { SettlementService, csvSettlementParser } from "./settlements/service";
import { ShipmentService } from "./shipments/service";
import { PgShipmentStore } from "./shipments/pg-store";
import { SourcingService } from "./suppliers/service";
import { TenantSettingsService } from "./settings/service";
import { OutboundWebhookService } from "./webhooks/outbound-service";
import { InboxService } from "./inbox/service";
import { systemClock } from "@ops-hub/shared";

/**
 * Builds the whole application from a pool and a Redis client. `server.ts`
 * uses it to serve; the integration tests use it to exercise every route.
 */
export function buildFullApp(
  pool: Pool,
  redis: Redis,
  options: BuildAppOptions = {},
): FastifyInstance {
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
  const auditReader = new PgAuditReader(pool);

  const productStore = new PgProductStore(pool);
  const variantStore = new PgVariantStore(pool);
  const catalog = new CatalogService({
    products: productStore,
    variants: variantStore,
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
    variants: variantStore,
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
  const eventStore: OrderEventStore = new PgOrderEventStore(pool);
  const duplicateDetection = new DuplicateDetectionService(
    orderStore,
    exceptionStore,
    systemClock,
  );
  const orders = new OrderService({
    store: orderStore,
    variants: variantStore,
    duplicateDetection,
    events: eventStore,
  });
  const orderValidation = new OrderValidationService({
    store: orderStore,
    exceptions: exceptionStore,
    variants: variantStore,
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
  const settings = new TenantSettingsService(pool);
  const riskGate = new RiskGateService({ pool, cod });
  const exchanges = new ExchangeService({ pool, clock: systemClock });
  const reconciler = new ReconcilerService({ pool, clock: systemClock });
  const cycleCounts = new CycleCounts({ pool, clock: systemClock });

  const sourcing = new SourcingService({
    pool,
    clock: systemClock,
    approvalThresholdMinor: Number(
      process.env.PO_APPROVAL_THRESHOLD_MINOR ?? 500000,
    ),
  });
  const scorecards = new ScorecardService({ pool, clock: systemClock });
  const inbox = new InboxService({ pool, clock: systemClock });
  const kpiService = new KpiService({ pool, clock: systemClock });
  const crm = new CrmService({ pool, clock: systemClock, kpis: kpiService });
  const starterAutomations = new StarterAutomationService({
    pool,
    clock: systemClock,
  });

  const playbooks = new PlaybookService({ pool, clock: systemClock });
  const sandbox = new SandboxService({ pool });
  const safety = new SafetyGuard({
    approvalThresholdMinor: Number(
      process.env.APPROVAL_THRESHOLD_MINOR ?? 100000,
    ),
    volumeCapPerHour: Number(process.env.VOLUME_CAP_PER_HOUR ?? 1000),
  });
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

  return buildApp({
    ...options,
    auth,
    apiKeys,
    audit,
    auditReader,
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
    phase2: {
      receiving,
      cod,
      returns,
      settlements,
      dlq,
      routing,
      riskGate,
      exchanges,
      reconciler,
      cycleCounts,
      settings,
    },
    phase3: { sourcing, scorecards, inbox, crm, starterAutomations },
    phase4: { playbooks, sandbox, safety },
    notifications,
    connectors,
  });
}
