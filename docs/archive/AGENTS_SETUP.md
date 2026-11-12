# Operix ERP - Agent Teams System Setup

## Overview

The Operix ERP includes a multi-agent system where specialized Claude agents work together to design and optimize different aspects of your ERP:

- **Backend Agent**: REST API design, business logic, server architecture
- **Frontend Agent**: React components, UI/UX, client-side optimization
- **Database Agent**: Schema design, query optimization, performance tuning
- **DevOps Agent**: Deployment, infrastructure, monitoring

## Prerequisites

1. **Anthropic API Key**: Required to use Claude agents
   - Get your API key from https://console.anthropic.com/
   - Add it to `.env.local`:
     ```
     ANTHROPIC_API_KEY=sk-ant-...
     ```

2. **Supabase**: Already configured in your project

## Using the Agent Console

1. **Start the development server**:

   ```bash
   npm run dev
   ```

2. **Navigate to the Agents Console**:
   - Open http://localhost:3001/dashboard/agents
   - Requires login with your Supabase credentials

3. **Send a task to an agent**:
   - Select an agent from the dropdown
   - Enter your task or question
   - Click "Send Task"
   - The agent will analyze the task and provide recommendations

## Example Tasks

### Backend Agent

```
Design a REST API endpoint for inventory management that supports:
- Listing products with pagination (limit, offset)
- Filtering by warehouse and stock status
- Real-time stock updates via webhooks
```

### Frontend Agent

```
Create a React component for displaying inventory levels with:
- Live stock count update
- Color-coded status (in stock, low stock, out of stock)
- Quick action buttons (reorder, transfer)
- Mobile responsive design
```

### Database Agent

```
Optimize the inventory queries for the following operations:
- Get total stock across all warehouses
- Find products below reorder point
- Track stock movements over time
- Show warehouse capacity utilization
```

### DevOps Agent

```
Design a monitoring strategy for the inventory system including:
- API response time tracking
- Database query performance alerts
- Stock data consistency checks
- Backup and recovery procedures
```

## Architecture

### Agent Routing

```
User Task
   ↓
/api/agents (POST)
   ↓
Orchestrator
   ↓
Select Agent → Call Claude API → Process Response
   ↓
Save Memory & Response
   ↓
Return to User
```

### Memory System

- Each agent maintains conversation history per session
- Decisions and context are persisted in `.claude/memory/`
- Agents can reference previous discussions and recommendations

### Files

- `lib/agents/config.ts` - Agent configurations and system prompts
- `lib/agents/orchestrator.ts` - Routes tasks to agents
- `lib/agents/memory.ts` - Persists agent memory between sessions
- `app/api/agents/route.ts` - API endpoint for agent interaction
- `components/AgentConsole.tsx` - Web UI for agents
- `app/(dashboard)/agents/page.tsx` - Agents page in dashboard

## Next Steps

1. Set up your ANTHROPIC_API_KEY
2. Test the agents via the console
3. Review recommendations from each agent
4. Implement approved changes in your codebase
5. Save agent decisions to memory for future reference

## Troubleshooting

### "Failed to process request"

- Verify ANTHROPIC_API_KEY is set in .env.local
- Check that you're logged in to the dashboard

### Agent not responding

- Check the console for error messages
- Verify API key is valid
- Try reloading the page

### Memory not saving

- Check that `.claude/memory/` directory exists
- Verify file permissions on the directory
