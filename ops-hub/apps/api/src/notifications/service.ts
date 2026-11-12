import net from "node:net";

import type { Pool } from "pg";
import { withTenant } from "@ops-hub/db";

import { NOTIFICATION_TEMPLATES, renderTemplate } from "./templates";

export interface NotificationSender {
  channel: "email" | "whatsapp";
  send(input: { to: string; subject?: string; body: string }): Promise<void>;
}

export class NotificationError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "NotificationError";
    this.statusCode = statusCode;
  }
}

/**
 * Minimal SMTP client (Mailpit in development). It speaks just enough of
 * SMTP to hand a message to a local mail server: EHLO, MAIL FROM, RCPT TO,
 * DATA, QUIT.
 */
export class SmtpSender implements NotificationSender {
  readonly channel = "email" as const;

  constructor(
    private readonly options: {
      host: string;
      port: number;
      from: string;
    },
  ) {}

  async send(input: {
    to: string;
    subject?: string;
    body: string;
  }): Promise<void> {
    const message = [
      `From: ${this.options.from}`,
      `To: ${input.to}`,
      `Subject: ${input.subject ?? "Ops Hub"}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.body,
    ].join("\r\n");

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(
        { host: this.options.host, port: this.options.port },
        () => {
          socket.write("EHLO ops-hub\r\n");
        },
      );
      let buffer = "";
      const steps = [
        () => socket.write(`MAIL FROM:<${this.options.from}>\r\n`),
        () => socket.write(`RCPT TO:<${input.to}>\r\n`),
        () => socket.write("DATA\r\n"),
        () => {
          socket.write(message.replace(/\r?\n/g, "\r\n"));
          socket.write("\r\n.\r\n");
        },
        () => socket.write("QUIT\r\n"),
      ];
      let step = -1;
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        if (!buffer.endsWith("\r\n")) return;
        if (buffer.startsWith("220") && step === -1) {
          step = 0;
          steps[0]!();
          buffer = "";
          return;
        }
        if (buffer.startsWith("250") || buffer.startsWith("354")) {
          step++;
          if (step < steps.length) {
            steps[step]!();
            buffer = "";
            return;
          }
          socket.end();
          resolve();
          return;
        }
        if (buffer.startsWith("5")) {
          socket.destroy();
          reject(new Error(`SMTP error: ${buffer.trim()}`));
          return;
        }
        buffer = "";
      });
      socket.on("error", reject);
      socket.on("close", () => resolve());
    });
  }
}

/** WhatsApp adapter stub: records the message instead of sending it. */
export class WhatsAppStubSender implements NotificationSender {
  readonly channel = "whatsapp" as const;
  readonly sent: { to: string; body: string }[] = [];

  async send(input: { to: string; body: string }): Promise<void> {
    this.sent.push({ to: input.to, body: input.body });
  }
}

/**
 * Proactive notifications (roadmap P1-S5-T07): each status change produces
 * at most one notification per template, in Arabic or English.
 */
export class NotificationService {
  constructor(
    private readonly deps: {
      pool: Pool;
      clock: { now(): Date };
      senders: NotificationSender[];
      locale?: "ar" | "en";
    },
  ) {}

  /**
   * Sends a template for an order. A second call for the same
   * (order, template) pair is a no-op.
   */
  async notify(
    tenantId: string,
    input: {
      orderId: string;
      templateKey: string;
      to: string;
      vars: Record<string, string>;
      channel?: "email" | "whatsapp";
    },
  ): Promise<{ sent: boolean; reason?: string }> {
    const template = NOTIFICATION_TEMPLATES.find(
      (t) => t.key === input.templateKey,
    );
    if (!template) {
      throw new NotificationError(
        `Unknown notification template "${input.templateKey}".`,
      );
    }
    const locale = this.deps.locale ?? "ar";
    const body = renderTemplate(
      locale === "ar" ? template.ar : template.en,
      input.vars,
    );
    const channel = input.channel ?? "email";

    // One notification per (order, template): the unique index makes a
    // second send a no-op instead of a duplicate.
    const claimed = await withTenant(
      this.deps.pool,
      tenantId,
      async (client) => {
        const r = await client.query(
          `insert into notifications
           (tenant_id, order_id, template_key, channel, recipient, body)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (tenant_id, order_id, template_key) do nothing
         returning id`,
          [tenantId, input.orderId, input.templateKey, channel, input.to, body],
        );
        return (r.rowCount ?? 0) > 0;
      },
    );
    if (!claimed) {
      return { sent: false, reason: "already sent" };
    }

    const sender = this.deps.senders.find((s) => s.channel === channel);
    if (!sender) {
      throw new NotificationError(
        `No sender configured for channel "${channel}".`,
      );
    }
    await sender.send({
      to: input.to,
      body,
      subject: template.en,
    });
    return { sent: true };
  }

  /** The templates available to this tenant. */
  async listTemplates(): Promise<{ key: string; ar: string; en: string }[]> {
    return NOTIFICATION_TEMPLATES.map((t) => ({
      key: t.key,
      ar: t.ar,
      en: t.en,
    }));
  }
}
