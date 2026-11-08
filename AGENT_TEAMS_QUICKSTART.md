# Agent Teams Quick Start Guide

Welcome! This guide will get you up and running with the Claude Agent Teams system in minutes.

## 🚀 5-Minute Setup

### Step 1: Set Your API Key

Copy the example environment file and add your Claude API key:

```bash
cp .env.agents.example .env.agents.local
```

Edit `.env.agents.local` and add:

```env
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
```

Or set it in your shell:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Step 2: Start the Dev Server

```bash
npm run dev
```

The app will start at `http://localhost:3000`.

### Step 3: Open Agent Console

Navigate to `/agents` in your browser to see the Agent Teams Console interface.

## 🎯 Basic Usage

### Via Web Console

1. Select an agent from the left sidebar
2. Type your task in the text area
3. Click "Send Task"
4. View the response in the console

### Via Command Line

Check agent status:

```bash
npm run agent:status
```

List all agents:

```bash
npm run agent:list
```

List available models:

```bash
npm run agent:models
```

Switch all agents to Sonnet:

```bash
npm run agent:switch sonnet-5-5
```

Switch backend agent to Opus:

```bash
npm run agent:switch backend opus-5-5
```

### Via API

Send a task to an agent:

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Design a REST API for inventory management",
    "agent": "backend",
    "sessionId": "session-001"
  }'
```

Get session information:

```bash
curl "http://localhost:3000/api/agents?sessionId=session-001"
```

Clear session memory:

```bash
curl -X DELETE "http://localhost:3000/api/agents?sessionId=session-001"
```

## 🧠 Agent Types

| Agent | Best For | Default Model |
|-------|----------|---------------|
| **Backend** | API design, business logic, architecture | Opus 5.5 |
| **Frontend** | React components, UI/UX, styling | Sonnet 5.5 |
| **Database** | Schema design, query optimization | Sonnet 5.5 |
| **DevOps** | Deployment, infrastructure, monitoring | Haiku 5.5 |

## 📝 Models & When to Use

### Claude Opus 5.5
- **Speed**: Slowest
- **Cost**: Most expensive
- **Use for**: Complex analysis, architecture decisions, deep reasoning
- **Example**: "Design a complete microservices architecture for an e-commerce platform"

### Claude Sonnet 5.5
- **Speed**: Balanced
- **Cost**: Moderate
- **Use for**: General development, code generation, testing
- **Example**: "Create a React hook for real-time inventory updates"

### Claude Haiku 5.5
- **Speed**: Fastest
- **Cost**: Least expensive
- **Use for**: Simple tasks, monitoring, quick answers
- **Example**: "Format this JSON log output"

## 💾 Memory Management

### Automatic Context Persistence

Each session automatically saves:
- Conversation history per agent
- Decisions made
- Project context
- Team knowledge

Memory is stored in `.claude/memory/` directory.

### Load Previous Session

To continue work from a previous session:

```typescript
// Previous session
const response1 = await fetch("/api/agents", {
  method: "POST",
  body: JSON.stringify({
    task: "Design the database schema",
    agent: "database",
    sessionId: "project-alpha"
  })
});

// Later session - memory auto-loads
const response2 = await fetch("/api/agents", {
  method: "POST",
  body: JSON.stringify({
    task: "Add caching to the schema design",
    agent: "database",
    sessionId: "project-alpha"  // Same session ID
  })
});
```

The agent will automatically have context from previous work!

### Export Session

From the web console:
1. Click "Export Session" button
2. Saves a JSON file with all messages and context

From CLI:

```bash
# Export memory for a session
npm run agent-cli memory export session-001
```

### Clear Memory

```bash
# Clear all memory for a session
npm run agent-cli memory clear session-001

# Or via API
curl -X DELETE "http://localhost:3000/api/agents?sessionId=session-001"
```

## 🔄 Multi-Agent Workflows

### Example: Design a Feature

**Session**: `feature-inventory-page`

**Step 1**: Backend designs the API

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Design a REST API for retrieving paginated inventory with filters and sorting",
    "agent": "backend",
    "sessionId": "feature-inventory-page"
  }'
```

**Step 2**: Frontend consumes the API

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a React component that fetches from the inventory API with pagination and filtering",
    "agent": "frontend",
    "sessionId": "feature-inventory-page"
  }'
```

**Step 3**: Database optimizes queries

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Optimize the database queries for efficient inventory filtering and pagination",
    "agent": "database",
    "sessionId": "feature-inventory-page"
  }'
```

Each agent has the context of previous work and can refine accordingly!

## ⚙️ Configuration

### Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Model Selection (defaults shown)
BACKEND_AGENT_MODEL=opus-5-5
FRONTEND_AGENT_MODEL=sonnet-5-5
DATABASE_AGENT_MODEL=sonnet-5-5
DEVOPS_AGENT_MODEL=haiku-5-5

# Memory
ENABLE_MEMORY_PERSISTENCE=true
MEMORY_RETENTION_DAYS=30
```

### Change Default Models

Edit `lib/agents/config.ts`:

```typescript
export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  backend: {
    model: "sonnet-5-5", // Changed from opus-5-5
    // ...
  },
};
```

## 🎨 Web Console Features

### Session Sidebar

Shows real-time stats:
- Number of messages
- Total tokens used
- Agents used
- Memory size
- Quick actions (refresh, export, clear)

### Agent Selection

Click the colored agent buttons to switch agents mid-conversation.

### Message History

All messages preserved with:
- Agent name and emoji
- Task and response
- Model used
- Tokens consumed
- Timestamp

### Export & Backup

Click "Export Session" to download:
- All messages
- Session stats
- Memory snapshot
- Full context

Perfect for documentation or sharing!

## 🔧 Troubleshooting

### "No API Key Found"

Make sure `.env.agents.local` exists with your API key:

```bash
echo $ANTHROPIC_API_KEY
# Should show your key
```

### Agents Not Responding

Check the API logs:

```bash
# In terminal where dev server runs
npm run dev
# Look for error messages
```

Test the API directly:

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"task":"Hello","agent":"backend","sessionId":"test"}'
```

### Memory Not Persisting

Verify the memory directory exists:

```bash
ls -la .claude/memory/
```

Create it if missing:

```bash
mkdir -p .claude/memory
```

### Model Switch Not Working

Clear agent history:

```bash
npm run agent-cli memory clear session-id
```

The agents reload config on each request, so changes take effect immediately.

## 📚 Next Steps

1. **Read CLAUDE.md** for complete documentation
2. **Check lib/agents/config.ts** to add custom agents
3. **Review app/api/agents/route.ts** for API extension
4. **Explore components/AgentConsole.tsx** for UI customization

## 💡 Pro Tips

1. **Use meaningful session IDs**: `project-alpha`, `feature-xyz` instead of random IDs
2. **Keep tasks focused**: One clear goal per task
3. **Review model costs**: Monitor tokens in the sidebar
4. **Export regularly**: Save important sessions before clearing
5. **Reuse context**: Use same sessionId for related work

## 🆘 Get Help

- Full documentation: See [CLAUDE.md](./CLAUDE.md)
- API docs: Check [app/api/agents/route.ts](./app/api/agents/route.ts)
- Examples: See [lib/agents/orchestrator.ts](./lib/agents/orchestrator.ts)

---

**Ready?** Open `http://localhost:3000/agents` in your browser and start using agents! 🚀
