# Connecting Claude to the Ops Hub MCP server

The Ops Hub MCP server (`apps/mcp`) exposes a curated, read-mostly tool set to
Claude and other agents. Every tool is a thin wrapper over the HTTP API, so
agents never touch the database.

## 1. Create an API key for the agent

```bash
curl -X POST http://localhost:3001/v1/api-keys \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "claude-mcp",
    "scopes": ["orders:read", "inventory:read", "reports:read", "orders:write"],
    "autoApproveScopes": ["auto_approve:orders:write"]
  }'
```

The secret is shown once — copy it into `OPS_HUB_API_KEY`.

Scopes granted decide which tools work. Write tools (`resolve_exception`,
`create_shipment`, `refund`, `cancel_order`) additionally need the matching
`auto_approve:<scope>` scope; without it the tool returns a **pending
approval** result and performs no write.

## 2. Run the server

```bash
cd ops-hub
pnpm install
OPS_HUB_API_URL=http://localhost:3001 \
OPS_HUB_API_KEY=<the key> \
OPS_HUB_SCOPES=orders:read,inventory:read,reports:read \
pnpm --filter @ops-hub/mcp start
```

The server speaks MCP over stdio, so it is normally launched by the client
rather than by hand.

## 3. Register it with Claude Desktop / Claude Code

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ops-hub": {
      "command": "pnpm",
      "args": ["--filter", "@ops-hub/mcp", "start"],
      "cwd": "/absolute/path/to/ops-hub",
      "env": {
        "OPS_HUB_API_URL": "http://localhost:3001",
        "OPS_HUB_API_KEY": "<the key>",
        "OPS_HUB_SCOPES": "orders:read,inventory:read,reports:read"
      }
    }
  }
}
```

## 4. Verify

```bash
pnpm --filter @ops-hub/mcp test
```

The test suite asserts the tool catalog, the JSON schemas, and that a write
tool without the auto-approve scope returns a pending-approval result with no
side effect.

## Tools exposed

| Tool                         | Scope             | Write?                   |
| ---------------------------- | ----------------- | ------------------------ |
| `search_orders`              | `orders:read`     | no                       |
| `get_order`                  | `orders:read`     | no                       |
| `get_inventory_availability` | `inventory:read`  | no                       |
| `list_exceptions`            | `orders:read`     | no                       |
| `get_shipment_status`        | `orders:read`     | no                       |
| `draft_customer_reply`       | `orders:write`    | drafts only, never sends |
| `generate_daily_report`      | `reports:read`    | no                       |
| `resolve_exception`          | `orders:write`    | yes — approval required  |
| `create_shipment`            | `orders:write`    | yes — approval required  |
| `refund`                     | `refunds:approve` | yes — approval required  |
| `cancel_order`               | `orders:write`    | yes — approval required  |
