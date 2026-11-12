import { z } from "zod";

/**
 * Curated MCP tool definitions for the Ops Hub API.
 *
 * Every tool is a thin, read-mostly wrapper over the HTTP API so an agent
 * never talks to the database directly. Write tools carry an explicit
 * `requiresApproval` flag; the MCP server refuses them unless the key has
 * the matching auto-approve scope.
 */

export const searchOrdersInput = z.object({
  phone: z.string().optional().describe("Customer phone (E.164 or local)."),
  orderNumber: z.string().optional().describe("Order number, e.g. OP-10001."),
  status: z.string().optional().describe("Order status."),
  limit: z.number().int().min(1).max(100).default(25),
});

export const getOrderInput = z.object({
  orderId: z.string().describe("Order id (uuid) or order number."),
});

export const getInventoryAvailabilityInput = z.object({
  sku: z.string().describe("SKU to look up."),
  locationId: z.string().optional().describe("Restrict to one location."),
});

export const listExceptionsInput = z.object({
  status: z.enum(["open", "assigned", "resolved"]).optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

export const resolveExceptionInput = z.object({
  exceptionId: z.string().describe("Exception id (uuid)."),
  resolution: z.string().min(1).describe("How the exception was resolved."),
});

export const getShipmentStatusInput = z.object({
  trackingNumber: z.string().optional().describe("Tracking number."),
  shipmentId: z.string().optional().describe("Shipment id (uuid)."),
});

export const draftCustomerReplyInput = z.object({
  orderId: z.string().describe("Order the reply is about."),
  message: z.string().min(1).describe("The drafted reply body."),
});

export const generateDailyReportInput = z.object({
  date: z.string().optional().describe("Report date (YYYY-MM-DD)."),
});

export const createShipmentInput = z.object({
  orderId: z.string(),
  recipient: z.object({ name: z.string().optional(), phone: z.string() }),
  address: z.object({
    line1: z.string(),
    governorateCode: z.string().optional(),
  }),
  items: z.array(
    z.object({ sku: z.string(), quantity: z.number().int().positive() }),
  ),
});

export const refundInput = z.object({
  orderId: z.string(),
  amountMinor: z.number().int().nonnegative(),
  reason: z.string().min(1),
});

export const cancelOrderInput = z.object({
  orderId: z.string(),
  reason: z.string().min(1),
});

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  /** Write tools require an explicit auto-approve scope on the API key. */
  requiresApproval?: boolean;
  scope: string;
}

/** The curated tool set exposed to agents (roadmap P4-S14-T01). */
export const TOOLS: ToolDefinition[] = [
  {
    name: "search_orders",
    description:
      "Find orders by customer phone, order number or status. Returns a compact list, newest first.",
    inputSchema: searchOrdersInput,
    scope: "orders:read",
  },
  {
    name: "get_order",
    description:
      "Read one order with its lines, payment, customer and address.",
    inputSchema: getOrderInput,
    scope: "orders:read",
  },
  {
    name: "get_inventory_availability",
    description:
      "Available-to-promise for a SKU, optionally restricted to one location.",
    inputSchema: getInventoryAvailabilityInput,
    scope: "inventory:read",
  },
  {
    name: "list_exceptions",
    description:
      "List operational exceptions (on-hold orders, scan gaps, duplicates).",
    inputSchema: listExceptionsInput,
    scope: "orders:read",
  },
  {
    name: "resolve_exception",
    description: "Resolve an exception with a short resolution note.",
    inputSchema: resolveExceptionInput,
    scope: "orders:write",
    requiresApproval: true,
  },
  {
    name: "get_shipment_status",
    description: "Current status and event history of a shipment.",
    inputSchema: getShipmentStatusInput,
    scope: "orders:read",
  },
  {
    name: "draft_customer_reply",
    description:
      "Draft (never send) a customer-facing reply for an order. The draft is stored, not delivered.",
    inputSchema: draftCustomerReplyInput,
    scope: "orders:write",
  },
  {
    name: "generate_daily_report",
    description:
      "Daily operations summary: orders, shipments, open exceptions and COD collection.",
    inputSchema: generateDailyReportInput,
    scope: "reports:read",
  },
  {
    name: "create_shipment",
    description: "Create a shipment for a confirmed order.",
    inputSchema: createShipmentInput,
    scope: "orders:write",
    requiresApproval: true,
  },
  {
    name: "refund",
    description: "Refund an order. Requires the refunds:approve permission.",
    inputSchema: refundInput,
    scope: "refunds:approve",
    requiresApproval: true,
  },
  {
    name: "cancel_order",
    description: "Cancel an order before dispatch.",
    inputSchema: cancelOrderInput,
    scope: "orders:write",
    requiresApproval: true,
  },
];
