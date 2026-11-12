import { zodToJsonSchema } from "zod-to-json-schema";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { TOOLS, type ToolDefinition } from "./tools";

export interface McpClient {
  apiUrl: string;
  apiKey: string;
  scopes: string[];
}

export type ToolResult = CallToolResult;

/**
 * Redaction for agent responses (roadmap P4-S14-T04): phones and addresses
 * are masked unless the key carries `pii:read`.
 */
export function redactPii(value: unknown, scopes: string[]): unknown {
  if (scopes.includes("pii:read")) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactPii(item, scopes));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "phone" && typeof item === "string") {
        out[key] = maskPhone(item);
      } else if (
        (key === "line1" || key === "line2" || key === "address") &&
        typeof item === "string"
      ) {
        out[key] = "***";
      } else {
        out[key] = redactPii(item, scopes);
      }
    }
    return out;
  }
  return value;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/** JSON schema for every curated tool, keyed by tool name. */
export function toolJsonSchemas(): Record<string, Record<string, unknown>> {
  const schemas: Record<string, Record<string, unknown>> = {};
  for (const tool of TOOLS) {
    schemas[tool.name] = zodToJsonSchema(tool.inputSchema, {
      target: "jsonSchema7",
      $refStrategy: "none",
    }) as Record<string, unknown>;
  }
  return schemas;
}

/** Tool descriptors for `tools/list`. */
export function listTools(): {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}[] {
  const schemas = toolJsonSchemas();
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: schemas[tool.name]!,
  }));
}

export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}

/**
 * Write tools are gated: an agent may only call one when the API key
 * carries the auto-approve scope for it. Otherwise the call is refused with
 * a pending-approval notice and no side effect happens.
 */
export function isApproved(client: McpClient, tool: ToolDefinition): boolean {
  if (!tool.requiresApproval) return true;
  return client.scopes.includes(`auto_approve:${tool.scope}`);
}

async function callApi(
  client: McpClient,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${client.apiUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${client.apiKey}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    // keep raw text
  }
  if (!res.ok) {
    throw new Error(
      `API ${method} ${path} failed with ${res.status}: ${text.slice(0, 400)}`,
    );
  }
  return parsed;
}

function ok(payload: unknown, client?: McpClient): ToolResult {
  const safe =
    client === undefined ? payload : redactPii(payload, client.scopes);
  return {
    content: [{ type: "text", text: JSON.stringify(safe, null, 2) }],
  };
}

function err(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Executes a curated tool against the Ops Hub API.
 * Returns a pending-approval result instead of performing the write when the
 * key lacks the auto-approve scope.
 */
export async function callTool(
  client: McpClient,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tool = findTool(name);
  if (!tool) {
    return err(`Unknown tool: ${name}`);
  }
  if (!isApproved(client, tool)) {
    return {
      content: [
        {
          type: "text",
          text: `PENDING APPROVAL: "${name}" is a write action and the key lacks the auto_approve:${tool.scope} scope. No side effect was performed.`,
        },
      ],
    };
  }

  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    return err(
      `Invalid arguments for ${name}: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ")}`,
    );
  }
  const input = parsed.data as Record<string, unknown>;

  try {
    switch (name) {
      case "search_orders": {
        const params = new URLSearchParams();
        if (input.phone) params.set("phone", String(input.phone));
        if (input.orderNumber)
          params.set("orderNumber", String(input.orderNumber));
        if (input.status) params.set("status", String(input.status));
        params.set("limit", String(input.limit));
        return ok(await callApi(client, "GET", `/v1/orders?${params}`));
      }
      case "get_order":
        return ok(
          await callApi(client, "GET", `/v1/orders/${input.orderId}`),
          client,
        );
      case "get_inventory_availability": {
        const params = new URLSearchParams({ sku: String(input.sku) });
        if (input.locationId)
          params.set("locationId", String(input.locationId));
        return ok(
          await callApi(client, "GET", `/v1/inventory/availability?${params}`),
          client,
        );
      }
      case "list_exceptions": {
        const params = new URLSearchParams({ limit: String(input.limit) });
        if (input.status) params.set("status", String(input.status));
        return ok(
          await callApi(client, "GET", `/v1/exceptions?${params}`),
          client,
        );
      }
      case "resolve_exception":
        return ok(
          await callApi(
            client,
            "POST",
            `/v1/exceptions/${input.exceptionId}/resolve`,
            {
              resolution: input.resolution,
            },
          ),
        );
      case "get_shipment_status":
        if (input.shipmentId) {
          return ok(
            await callApi(
              client,
              "GET",
              `/v1/shipments/${input.shipmentId}/status`,
            ),
            client,
          );
        }
        return ok(
          await callApi(
            client,
            "GET",
            `/v1/shipments/tracking/${input.trackingNumber}`,
          ),
          client,
        );
      case "draft_customer_reply":
        return ok(
          await callApi(client, "POST", `/v1/orders/${input.orderId}/events`, {
            note: input.message,
            customerVisible: false,
          }),
          client,
        );
      case "generate_daily_report": {
        const params = new URLSearchParams();
        if (input.date) params.set("date", String(input.date));
        return ok(
          await callApi(client, "GET", `/v1/reports/daily?${params}`),
          client,
        );
      }
      case "create_shipment":
        return ok(await callApi(client, "POST", "/v1/shipments", input));
      case "refund":
        return ok(
          await callApi(
            client,
            "POST",
            `/v1/orders/${input.orderId}/refund`,
            input,
          ),
        );
      case "cancel_order":
        return ok(
          await callApi(
            client,
            "POST",
            `/v1/orders/${input.orderId}/cancel`,
            input,
          ),
        );
      default:
        return err(`Tool ${name} is not implemented.`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
