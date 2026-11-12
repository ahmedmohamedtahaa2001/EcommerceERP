/**
 * Ops Hub MCP server.
 *
 * Exposes the curated tool set to Claude and other agents over stdio.
 * Configuration comes from the environment:
 *
 *   OPS_HUB_API_URL  base URL of the Ops Hub API (default http://localhost:3001)
 *   OPS_HUB_API_KEY  the API key used for every call
 *   OPS_HUB_SCOPES   comma-separated scopes the key carries
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { callTool, listTools, type McpClient } from "./client";

const client: McpClient = {
  apiUrl: process.env.OPS_HUB_API_URL ?? "http://localhost:3001",
  apiKey: process.env.OPS_HUB_API_KEY ?? "",
  scopes: (process.env.OPS_HUB_SCOPES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
};

const server = new Server(
  { name: "ops-hub", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: listTools(),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return callTool(client, name, (args ?? {}) as Record<string, unknown>);
});

const transport = new StdioServerTransport();
await server.connect(transport);
