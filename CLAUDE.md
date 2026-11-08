# Claude Agent Teams & Memory System

This document outlines how to work with Claude agent teams, switch between models, and maintain memory across sessions for the Operix ERP system.

## Table of Contents

1. [Agent Teams Architecture](#agent-teams-architecture)
2. [Setting Up Agent Teams](#setting-up-agent-teams)
3. [Model Switching](#model-switching)
4. [Memory Management Between Sessions](#memory-management-between-sessions)
5. [Working with Agents](#working-with-agents)
6. [Common Workflows](#common-workflows)

---

## Agent Teams Architecture

The agent teams approach enables **specialized agents** to work together on complex tasks. Each agent has a specific role and expertise area, coordinating through a central orchestrator.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Orchestrator (Main)                     │
│  - Routes tasks to specialized agents                   │
│  - Manages memory & context persistence                 │
│  - Coordinates cross-agent workflows                    │
└─────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
    │ Backend│    │Frontend│    │ Database│   │ DevOps │
    │ Agent  │    │ Agent  │    │ Agent   │   │ Agent  │
    └────────┘    └────────┘    └────────┘    └────────┘
```

### Agent Roles

- **Backend Agent**: REST API design, business logic, server-side optimization
- **Frontend Agent**: UI/UX, React components, client-side logic
- **Database Agent**: Schema design, queries, performance tuning
- **DevOps Agent**: Deployment, infrastructure, monitoring

---

## Setting Up Agent Teams

### Step 1: Create Agent Configuration

Create a new file `lib/agents/config.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

export interface AgentConfig {
  name: string;
  role: string;
  model: "opus-5-5" | "sonnet-5-5" | "haiku-5-5";
  systemPrompt: string;
  temperature?: number;
}

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  backend: {
    name: "Backend Agent",
    role: "Backend architecture and API design",
    model: "opus-5-5",
    systemPrompt: `You are an expert backend engineer specializing in REST API design, 
server architecture, and business logic. Analyze requirements and provide optimized solutions.`,
    temperature: 0.2,
  },
  frontend: {
    name: "Frontend Agent",
    role: "Frontend development and UI/UX",
    model: "sonnet-5-5",
    systemPrompt: `You are an expert frontend engineer specializing in React, TypeScript, and UX design. 
Create component architectures and optimize user interactions.`,
    temperature: 0.3,
  },
  database: {
    name: "Database Agent",
    role: "Database schema and query optimization",
    model: "sonnet-5-5",
    systemPrompt: `You are an expert database architect. Design efficient schemas, write optimized queries, 
and ensure data integrity.`,
    temperature: 0.2,
  },
  devops: {
    name: "DevOps Agent",
    role: "Deployment, infrastructure, and monitoring",
    model: "haiku-5-5",
    systemPrompt: `You are an expert DevOps engineer. Handle deployment pipelines, 
infrastructure setup, and system monitoring.`,
    temperature: 0.2,
  },
};
```

### Step 2: Create Orchestrator

Create `lib/agents/orchestrator.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { AGENT_CONFIGS, AgentConfig } from "./config";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface AgentResponse {
  agent: string;
  response: string;
  model: string;
  tokensUsed?: number;
}

class AgentOrchestrator {
  private client: Anthropic;
  private conversationHistory: Map<string, Message[]> = new Map();

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async routeTask(task: string, primaryAgent: string): Promise<AgentResponse> {
    const config = AGENT_CONFIGS[primaryAgent];
    if (!config) {
      throw new Error(`Unknown agent: ${primaryAgent}`);
    }

    const history = this.getConversationHistory(primaryAgent);
    history.push({ role: "user", content: task });

    const response = await this.client.messages.create({
      model: config.model,
      max_tokens: 2048,
      system: config.systemPrompt,
      messages: history,
    });

    const assistantMessage =
      response.content[0].type === "text" ? response.content[0].text : "";

    history.push({ role: "assistant", content: assistantMessage });
    this.saveConversationHistory(primaryAgent, history);

    return {
      agent: config.name,
      response: assistantMessage,
      model: config.model,
      tokensUsed:
        (response.usage?.input_tokens || 0) +
        (response.usage?.output_tokens || 0),
    };
  }

  private getConversationHistory(agentId: string): Message[] {
    return (
      this.conversationHistory.get(agentId) || [
        {
          role: "user",
          content: "You are now activated. Ready to help with your expertise.",
        },
      ]
    );
  }

  private saveConversationHistory(agentId: string, history: Message[]): void {
    this.conversationHistory.set(agentId, history);
  }

  clearHistory(agentId?: string): void {
    if (agentId) {
      this.conversationHistory.delete(agentId);
    } else {
      this.conversationHistory.clear();
    }
  }
}

export const orchestrator = new AgentOrchestrator();
```

### Step 3: Create Memory Manager

Create `lib/agents/memory.ts`:

```typescript
import fs from "fs/promises";
import path from "path";

export interface Memory {
  sessionId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface SessionMemory {
  agentId: string;
  decisions: string[];
  context: Record<string, unknown>;
  sharedKnowledge: Record<string, unknown>;
}

class MemoryManager {
  private memoryDir = path.join(process.cwd(), ".claude", "memory");

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });
    } catch (error) {
      console.error("Failed to initialize memory directory:", error);
    }
  }

  async saveMemory(
    sessionId: string,
    agentId: string,
    memory: SessionMemory
  ): Promise<void> {
    const filePath = path.join(
      this.memoryDir,
      `${sessionId}-${agentId}.json`
    );

    try {
      const data = {
        ...memory,
        savedAt: new Date().toISOString(),
      };
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Failed to save memory for ${agentId}:`, error);
    }
  }

  async loadMemory(
    sessionId: string,
    agentId: string
  ): Promise<SessionMemory | null> {
    const filePath = path.join(
      this.memoryDir,
      `${sessionId}-${agentId}.json`
    );

    try {
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.log(`No memory found for ${agentId}`);
      return null;
    }
  }

  async saveSharedMemory(sessionId: string, data: Record<string, unknown>) {
    const filePath = path.join(this.memoryDir, `${sessionId}-shared.json`);

    try {
      const sharedMemory = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await fs.writeFile(filePath, JSON.stringify(sharedMemory, null, 2));
    } catch (error) {
      console.error("Failed to save shared memory:", error);
    }
  }

  async loadSharedMemory(sessionId: string): Promise<Record<string, unknown>> {
    const filePath = path.join(this.memoryDir, `${sessionId}-shared.json`);

    try {
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.log("No shared memory found");
      return {};
    }
  }

  async clearMemory(sessionId: string, agentId?: string): Promise<void> {
    try {
      if (agentId) {
        const filePath = path.join(
          this.memoryDir,
          `${sessionId}-${agentId}.json`
        );
        await fs.unlink(filePath);
      } else {
        // Clear all memories for session
        const files = await fs.readdir(this.memoryDir);
        for (const file of files) {
          if (file.startsWith(sessionId)) {
            await fs.unlink(path.join(this.memoryDir, file));
          }
        }
      }
    } catch (error) {
      console.error("Failed to clear memory:", error);
    }
  }
}

export const memoryManager = new MemoryManager();
```

---

## Model Switching

### Supported Models

- **claude-opus-5-5** (`opus-5-5`): Most capable, best for complex reasoning
- **claude-sonnet-5-5** (`sonnet-5-5`): Balanced speed/capability
- **claude-haiku-5-5** (`haiku-5-5`): Fastest, good for simple tasks

### Switching Models

#### Option 1: Update Agent Config

Edit `lib/agents/config.ts`:

```typescript
export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  backend: {
    // ... other settings
    model: "sonnet-5-5", // Changed from opus-5-5
  },
  // ...
};
```

#### Option 2: Runtime Switching

Create `lib/agents/model-switcher.ts`:

```typescript
import { AGENT_CONFIGS } from "./config";

type ModelName = "opus-5-5" | "sonnet-5-5" | "haiku-5-5";

export class ModelSwitcher {
  switchAgentModel(agentId: string, model: ModelName): void {
    const config = AGENT_CONFIGS[agentId];
    if (!config) {
      throw new Error(`Agent ${agentId} not found`);
    }
    config.model = model;
    console.log(
      `✓ Switched ${config.name} to model: ${model}`
    );
  }

  switchAllAgents(model: ModelName): void {
    Object.keys(AGENT_CONFIGS).forEach((agentId) => {
      this.switchAgentModel(agentId, model);
    });
    console.log(`✓ All agents switched to: ${model}`);
  }

  getAgentModel(agentId: string): ModelName | undefined {
    return AGENT_CONFIGS[agentId]?.model;
  }

  getAllModels(): Record<string, ModelName> {
    const result: Record<string, ModelName> = {};
    Object.entries(AGENT_CONFIGS).forEach(([id, config]) => {
      result[id] = config.model;
    });
    return result;
  }
}

export const modelSwitcher = new ModelSwitcher();
```

#### Option 3: Environment-Based Switching

Create `.env` file:

```env
# Model Selection
BACKEND_AGENT_MODEL=opus-5-5
FRONTEND_AGENT_MODEL=sonnet-5-5
DATABASE_AGENT_MODEL=sonnet-5-5
DEVOPS_AGENT_MODEL=haiku-5-5

# Claude API
ANTHROPIC_API_KEY=your-api-key-here
```

Update `lib/agents/config.ts`:

```typescript
export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  backend: {
    name: "Backend Agent",
    role: "Backend architecture and API design",
    model: (process.env.BACKEND_AGENT_MODEL as any) || "opus-5-5",
    systemPrompt: "...",
  },
  // ... other agents
};
```

---

## Memory Management Between Sessions

### How It Works

1. **Agent-Specific Memory**: Each agent maintains its own conversation history and decisions
2. **Shared Memory**: Teams can access shared context and discoveries
3. **Persistent Storage**: Memory is saved to `.claude/memory/` directory
4. **Session Isolation**: Each session has its own memory scope

### Usage Example

```typescript
import { memoryManager } from "@/lib/agents/memory";
import { orchestrator } from "@/lib/agents/orchestrator";

// Initialize
await memoryManager.initialize();

const sessionId = "session-001";
const agentId = "backend";

// Save agent memory
await memoryManager.saveMemory(sessionId, agentId, {
  agentId,
  decisions: [
    "Use REST API with OpenAPI spec",
    "Implement request validation with Zod",
  ],
  context: {
    projectType: "e-commerce ERP",
    framework: "Next.js 14",
  },
  sharedKnowledge: {
    databaseProvider: "Firebase Firestore",
    authMethod: "JWT tokens",
  },
});

// Load agent memory in next session
const previousMemory = await memoryManager.loadMemory(sessionId, agentId);
if (previousMemory) {
  console.log("Loaded previous context:", previousMemory.context);
}

// Save shared knowledge
await memoryManager.saveSharedMemory(sessionId, {
  projectName: "Operix ERP",
  teamDecisions: ["Use TypeScript everywhere", "Tailwind CSS for styling"],
  estimations: {
    backendDevelopment: "3 weeks",
    frontendDevelopment: "2 weeks",
  },
});
```

### Memory File Structure

```
.claude/memory/
├── session-001-backend.json    # Backend agent memory
├── session-001-frontend.json   # Frontend agent memory
├── session-001-database.json   # Database agent memory
├── session-001-devops.json     # DevOps agent memory
└── session-001-shared.json     # Shared team knowledge
```

### Clearing Memory

```typescript
// Clear specific agent memory
await memoryManager.clearMemory(sessionId, "backend");

// Clear all session memory
await memoryManager.clearMemory(sessionId);
```

---

## Working with Agents

### API Endpoint for Agent Interaction

Create `app/api/agents/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/agents/orchestrator";
import { memoryManager } from "@/lib/agents/memory";

export async function POST(request: NextRequest) {
  try {
    const { task, agent, sessionId } = await request.json();

    if (!task || !agent || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: task, agent, sessionId" },
        { status: 400 }
      );
    }

    // Initialize memory
    await memoryManager.initialize();

    // Load previous context
    const previousMemory = await memoryManager.loadMemory(sessionId, agent);
    const context = previousMemory
      ? `Previous context: ${JSON.stringify(previousMemory.context)}\n\n`
      : "";

    // Route task to agent
    const response = await orchestrator.routeTask(context + task, agent);

    // Save memory for next session
    await memoryManager.saveMemory(sessionId, agent, {
      agentId: agent,
      decisions: previousMemory?.decisions || [],
      context: {
        ...previousMemory?.context,
        lastTask: task,
        lastResponse: response.response,
      },
      sharedKnowledge: previousMemory?.sharedKnowledge || {},
    });

    return NextResponse.json({
      success: true,
      agent: response.agent,
      response: response.response,
      model: response.model,
      tokensUsed: response.tokensUsed,
    });
  } catch (error) {
    console.error("Agent routing error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
```

### Frontend Integration

Create `components/AgentConsole.tsx`:

```typescript
"use client";

import { useState } from "react";

export function AgentConsole() {
  const [sessionId] = useState(
    () => `session-${Date.now()}`
  );
  const [selectedAgent, setSelectedAgent] = useState("backend");
  const [task, setTask] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const agents = [
    { id: "backend", name: "Backend Agent" },
    { id: "frontend", name: "Frontend Agent" },
    { id: "database", name: "Database Agent" },
    { id: "devops", name: "DevOps Agent" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          agent: selectedAgent,
          sessionId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResponse(data.response);
      }
    } catch (error) {
      console.error("Error:", error);
      setResponse("Error communicating with agent");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-2xl font-bold">Agent Teams Console</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Select Agent</label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-sm text-gray-600">Session: {sessionId}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Enter task for the agent..."
          className="w-full border rounded px-3 py-2 min-h-24"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Processing..." : "Send Task"}
        </button>
      </form>

      {response && (
        <div className="bg-gray-100 rounded p-4">
          <h3 className="font-semibold mb-2">Response:</h3>
          <p className="whitespace-pre-wrap text-sm">{response}</p>
        </div>
      )}
    </div>
  );
}
```

---

## Common Workflows

### Workflow 1: Design a New API Endpoint

```bash
# 1. Backend agent designs the endpoint
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Design a REST endpoint for inventory management with pagination, filtering, and sorting",
    "agent": "backend",
    "sessionId": "session-001"
  }'

# 2. Frontend agent creates the consumer
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a React hook and component to consume the inventory API with real-time updates",
    "agent": "frontend",
    "sessionId": "session-001"
  }'

# 3. Database agent optimizes queries
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Optimize the database queries for the inventory endpoint with appropriate indexes",
    "agent": "database",
    "sessionId": "session-001"
  }'
```

### Workflow 2: Performance Investigation

```typescript
// Use the memory system to persist findings
const sessionId = "perf-investigation-001";

// Agents work together, each saving their findings
await memoryManager.saveMemory(sessionId, "backend", {
  agentId: "backend",
  decisions: ["Implement caching layer"],
  context: { bottleneck: "database queries" },
  sharedKnowledge: {},
});

// Load and combine findings
const backendFindings = await memoryManager.loadMemory(
  sessionId,
  "backend"
);
const dbFindings = await memoryManager.loadMemory(sessionId, "database");

console.log("Combined analysis:", {
  backend: backendFindings,
  database: dbFindings,
});
```

### Workflow 3: Multi-Session Continuity

```typescript
const sessionId = "project-alpha";

// Session 1: Initial design
await orchestrator.routeTask(
  "Design the order processing system",
  "backend"
);

// ... Later, Session 2: Load previous context and continue
const previousContext = await memoryManager.loadMemory(sessionId, "backend");

await orchestrator.routeTask(
  `Previous work: ${JSON.stringify(
    previousContext
  )}\nNow implement error handling for the order system`,
  "backend"
);
```

---

## Quick Reference

### Initialize Agents

```typescript
import { memoryManager } from "@/lib/agents/memory";

await memoryManager.initialize();
```

### Switch Model

```typescript
import { modelSwitcher } from "@/lib/agents/model-switcher";

modelSwitcher.switchAgentModel("backend", "sonnet-5-5");
```

### Route Task

```typescript
import { orchestrator } from "@/lib/agents/orchestrator";

const response = await orchestrator.routeTask(
  "Your task here",
  "backend"
);
console.log(response.response);
```

### Save & Load Memory

```typescript
import { memoryManager } from "@/lib/agents/memory";

// Save
await memoryManager.saveMemory(sessionId, agentId, memory);

// Load
const memory = await memoryManager.loadMemory(sessionId, agentId);
```

---

## Best Practices

1. **Session IDs**: Use meaningful session IDs like `project-alpha` or timestamps
2. **Model Selection**: Use Opus for complex reasoning, Sonnet for balance, Haiku for simple tasks
3. **Memory Cleanup**: Periodically clean old memories with `clearMemory()`
4. **Error Handling**: Always wrap orchestrator calls in try-catch
5. **Context Passing**: Always load previous memory before routing new tasks
6. **Shared Knowledge**: Keep shared memory updated with team decisions

---

## Troubleshooting

### Memory Not Persisting

Check that `.claude/memory/` directory exists:

```bash
mkdir -p .claude/memory
```

### Agents Not Responding

Verify `ANTHROPIC_API_KEY` is set:

```bash
echo $ANTHROPIC_API_KEY
```

### Model Switching Not Working

Clear the orchestrator history:

```typescript
orchestrator.clearHistory();
```

---

## Resources

- [Claude API Documentation](https://platform.claude.com/docs)
- [Agents & Tools Guide](https://platform.claude.com/docs/en/agents-and-tools/agents)
- [Memory Tool Documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Agent Teams Approach](https://code.claude.com/docs/en/agent-teams)

---

**Last Updated**: 2026-11-08  
**Author**: Ahmed Taha  
**Project**: Operix ERP
