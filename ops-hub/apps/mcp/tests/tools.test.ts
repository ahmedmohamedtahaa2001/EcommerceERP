import { describe, expect, it } from "vitest";

import { callTool, isApproved, listTools, redactPii } from "../src/client";
import { TOOLS } from "../src/tools";

const client = {
  apiUrl: "http://127.0.0.1:1",
  apiKey: "key",
  scopes: ["orders:read", "inventory:read"],
};

function textOf(result: { content: unknown[] }): string {
  const first = result.content[0] as { type?: string; text?: string };
  return first?.text ?? "";
}

describe("MCP tool catalog", () => {
  it("exposes every curated tool from the roadmap", () => {
    const names = listTools().map((t) => t.name);
    for (const expected of [
      "search_orders",
      "get_order",
      "get_inventory_availability",
      "list_exceptions",
      "resolve_exception",
      "get_shipment_status",
      "draft_customer_reply",
      "generate_daily_report",
      "create_shipment",
      "refund",
      "cancel_order",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("gives every tool a JSON schema with a description", () => {
    for (const tool of listTools()) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("gates write tools behind an auto-approve scope", () => {
    const refund = TOOLS.find((t) => t.name === "refund");
    expect(refund).toBeDefined();
    expect(refund!.requiresApproval).toBe(true);
    expect(isApproved(client, refund!)).toBe(false);
    expect(
      isApproved(
        { ...client, scopes: ["auto_approve:refunds:approve"] },
        refund!,
      ),
    ).toBe(true);
  });

  it("allows read tools without any extra scope", () => {
    const search = TOOLS.find((t) => t.name === "search_orders");
    expect(search).toBeDefined();
    expect(isApproved(client, search!)).toBe(true);
  });

  it("returns a pending-approval result and performs no write", async () => {
    const result = await callTool(client, "refund", {
      orderId: "o1",
      amountMinor: 100,
      reason: "test",
    });
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("PENDING APPROVAL");
    expect(textOf(result)).toContain("No side effect was performed");
  });

  it("rejects invalid arguments before calling the API", async () => {
    const result = await callTool(client, "search_orders", { limit: 999 });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Invalid arguments");
  });

  it("masks phones and addresses without the pii:read scope", () => {
    const masked = redactPii(
      { phone: "+201012345678", line1: "12 Street", name: "Ahmed" },
      ["orders:read"],
    ) as Record<string, string>;
    expect(masked.phone).toBe("********5678");
    expect(masked.line1).toBe("***");
    expect(masked.name).toBe("Ahmed");
  });

  it("keeps PII when the key has the pii:read scope", () => {
    const plain = redactPii({ phone: "+201012345678" }, [
      "orders:read",
      "pii:read",
    ]) as Record<string, string>;
    expect(plain.phone).toBe("+201012345678");
  });

  it("reports unknown tools", async () => {
    const result = await callTool(client, "nope", {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Unknown tool");
  });
});
