import { randomUUID } from "node:crypto";

import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  NotificationService,
  WhatsAppStubSender,
} from "../src/notifications/service";
import {
  renderTemplate,
  NOTIFICATION_TEMPLATES,
} from "../src/notifications/templates";
import { ConnectorHealthService } from "../src/integrations/connectors/health";

describe("Notification templates", () => {
  it("has Arabic and English text for every status", () => {
    expect(NOTIFICATION_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const template of NOTIFICATION_TEMPLATES) {
      expect(template.ar.length).toBeGreaterThan(0);
      expect(template.en.length).toBeGreaterThan(0);
    }
  });

  it("renders the variables into the template", () => {
    expect(renderTemplate("Hi {name}", { name: "Ahmed" })).toBe("Hi Ahmed");
  });
});

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://ops_hub:ops_hub@localhost:5432/ops_hub";
const runDbTests = process.env.RUN_DB_TESTS === "1";
const tenantId = "00000000-0000-4000-8000-000000004401";
const pool = new Pool({ connectionString: databaseUrl });
const client = new Client({ connectionString: databaseUrl });

describe.skipIf(!runDbTests)(
  "Notifications and connector health against Postgres",
  () => {
    beforeAll(async () => {
      await client.connect();
      await client.query("delete from notifications where tenant_id=$1", [
        tenantId,
      ]);
      await client.query("delete from connectors where tenant_id=$1", [
        tenantId,
      ]);
      await client.query("delete from tenants where id=$1", [tenantId]);
      await client.query(
        "insert into tenants (id, slug, name) values ($1,'notify-a','Notifications Tenant')",
        [tenantId],
      );
    });

    afterAll(async () => {
      await pool.end();
      await client.end();
    });

    it("sends each template at most once per order", async () => {
      const sender = new WhatsAppStubSender();
      const service = new NotificationService({
        pool,
        clock: { now: () => new Date() },
        senders: [sender],
      });

      const orderId = randomUUID();
      const first = await service.notify(tenantId, {
        orderId,
        templateKey: "confirmed",
        to: "+201012345678",
        vars: { orderNumber: "OP-10001" },
        channel: "whatsapp",
      });
      expect(first.sent).toBe(true);

      const second = await service.notify(tenantId, {
        orderId,
        templateKey: "confirmed",
        to: "+201012345678",
        vars: { orderNumber: "OP-10001" },
        channel: "whatsapp",
      });
      expect(second.sent).toBe(false);
      expect(second.reason).toBe("already sent");
      expect(sender.sent).toHaveLength(1);
      expect(sender.sent[0]!.body).toContain("OP-10001");
    });

    it("rejects an unknown template", async () => {
      const service = new NotificationService({
        pool,
        clock: { now: () => new Date() },
        senders: [new WhatsAppStubSender()],
      });
      await expect(
        service.notify(tenantId, {
          orderId: randomUUID(),
          templateKey: "nope",
          to: "+201000000000",
          vars: {},
        }),
      ).rejects.toThrow(/Unknown notification template/);
    });

    it("pauses a connector whose token has expired", async () => {
      const service = new ConnectorHealthService({
        pool,
        clock: { now: () => new Date() },
      });
      await service.register(tenantId, {
        name: "shopify",
        type: "shopify",
        tokenExpiresAt: new Date(Date.now() - 1000),
      });
      const health = await service.recordFailure(
        tenantId,
        "shopify",
        "token expired",
      );
      expect(health.enabled).toBe(false);
      expect(await service.canWrite(tenantId, "shopify")).toBe(false);
    });

    it("clears the error and resumes after a success", async () => {
      const service = new ConnectorHealthService({
        pool,
        clock: { now: () => new Date() },
      });
      await service.register(tenantId, { name: "bosta", type: "bosta" });
      await service.recordFailure(tenantId, "bosta", "timeout");
      let health = await service.list(tenantId);
      const bosta = health.find((c) => c.name === "bosta")!;
      expect(bosta.lastError).toBe("timeout");
      expect(bosta.errorRate).toBe(100);

      await service.recordSuccess(tenantId, "bosta");
      health = await service.list(tenantId);
      const after = health.find((c) => c.name === "bosta")!;
      expect(after.lastError).toBeNull();
      expect(after.lastSuccessAt).not.toBeNull();
      expect(await service.canWrite(tenantId, "bosta")).toBe(true);
    });
  },
);
