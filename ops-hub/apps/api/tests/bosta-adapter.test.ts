import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { BostaAdapter } from "../src/integrations/bosta/adapter";

const PORT = 4099;
let proc: ChildProcess;

beforeAll(async () => {
  proc = spawn("npx", ["tsx", "fixtures/courier/server.ts"], {
    cwd: process.cwd().replace(/\/apps\/api$/, ""),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  // wait for server
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/v1/rates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (r.ok) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("fake courier did not start");
}, 30000);

afterAll(() => {
  proc?.kill();
});

describe("BostaAdapter contract against fake courier", () => {
  const adapter = new BostaAdapter({
    apiKey: "test-key",
    baseUrl: `http://localhost:${PORT}`,
    environment: "test",
  });

  it("passes the core contract", async () => {
    const quotes = await adapter.quoteRate({
      destination: { line1: "x", governorateCode: "GZ" },
      items: [{ sku: "SKU1", quantity: 1 }],
    });
    expect(quotes.length).toBeGreaterThan(0);

    const created = await adapter.createShipment({
      tenantId: "00000000-0000-4000-8000-000000000001",
      orderId: "00000000-0000-4000-8000-000000000002",
      sequence: 1,
      recipient: { phone: "+201012345678" },
      address: { line1: "x", governorateCode: "GZ" },
      items: [{ sku: "SKU1", quantity: 1 }],
      idempotencyKey: "bosta-key-1",
    });
    expect(typeof created.carrierShipmentId).toBe("string");

    const status = await adapter.getStatus({
      carrierShipmentId: created.carrierShipmentId,
    });
    expect(typeof status.current).toBe("string");

    const label = await adapter.getLabel({
      carrierShipmentId: created.carrierShipmentId,
    });
    expect(label.contentType).toContain("pdf");

    const cancelled = await adapter.cancelShipment({
      carrierShipmentId: created.carrierShipmentId,
    });
    expect(typeof cancelled.cancelled).toBe("boolean");
  });
});
