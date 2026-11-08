#!/usr/bin/env node

import { orchestrator } from "@/lib/agents/orchestrator";
import { memoryManager } from "@/lib/agents/memory";
import { modelSwitcher } from "@/lib/agents/model-switcher";

type Command =
  | "status"
  | "switch"
  | "memory"
  | "help"
  | "list-agents"
  | "list-models"
  | "route-task";

interface CLIArgs {
  command: Command;
  args: string[];
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const command = (args[0] || "help") as Command;

  return {
    command,
    args: args.slice(1),
  };
}

function printHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        Claude Agent Teams - CLI Management Tool            ║
╚════════════════════════════════════════════════════════════╝

COMMANDS:

  status              Show current agent models status
  switch <model>      Switch all agents to a specific model
  switch <agent> <model>
                      Switch specific agent to a model
  memory <action>     Manage agent memory
                      - list: List all sessions
                      - clear <sessionId>: Clear session
  list-agents         List all available agents
  list-models         List all available models
  route-task          Send a task to an agent (interactive)
  help                Show this help message

MODELS:
  - opus-5-5          Most capable, slower, expensive
  - sonnet-5-5        Balanced speed and capability
  - haiku-5-5         Fast, cheaper, good for simple tasks

EXAMPLES:
  npm run agent-cli status
  npm run agent-cli switch sonnet-5-5
  npm run agent-cli switch backend opus-5-5
  npm run agent-cli list-agents
  npm run agent-cli memory list

For more information, see CLAUDE.md
`);
}

async function handleStatus(): Promise<void> {
  console.log("\n");
  modelSwitcher.printStatus();
  console.log("\nCost Breakdown:");
  const costEstimate = modelSwitcher.getEstimatedCost();
  if (costEstimate.cheap.length > 0) {
    console.log(`  💚 Cheap: ${costEstimate.cheap.join(", ")}`);
  }
  if (costEstimate.moderate.length > 0) {
    console.log(`  💛 Moderate: ${costEstimate.moderate.join(", ")}`);
  }
  if (costEstimate.expensive.length > 0) {
    console.log(`  ❤️ Expensive: ${costEstimate.expensive.join(", ")}`);
  }
}

async function handleSwitch(args: string[]): Promise<void> {
  if (args.length === 1) {
    const model = args[0];
    if (!["opus-5-5", "sonnet-5-5", "haiku-5-5"].includes(model)) {
      console.error(`❌ Invalid model: ${model}`);
      return;
    }

    modelSwitcher.switchAllAgents(model as any);
  } else if (args.length === 2) {
    const [agentId, model] = args;
    if (!["opus-5-5", "sonnet-5-5", "haiku-5-5"].includes(model)) {
      console.error(`❌ Invalid model: ${model}`);
      return;
    }

    if (modelSwitcher.switchAgentModel(agentId, model as any)) {
      console.log(`✅ Successfully switched ${agentId} to ${model}`);
    } else {
      console.error(`❌ Failed to switch model for ${agentId}`);
    }
  } else {
    console.error("Usage: agent-cli switch <model> or agent-cli switch <agent> <model>");
  }
}

async function handleMemory(args: string[]): Promise<void> {
  const action = args[0];

  try {
    await memoryManager.initialize();

    if (action === "list") {
      const sessions = await memoryManager.listSessions();

      if (sessions.length === 0) {
        console.log("\n📭 No sessions found");
        return;
      }

      console.log("\n📋 Available Sessions:\n");
      sessions.forEach((session) => {
        console.log(`  Session: ${session.sessionId}`);
        console.log(`    Agents: ${session.agents.join(", ")}`);
        console.log(`    Last Updated: ${session.lastUpdated}`);
        console.log();
      });
    } else if (action === "clear" && args[1]) {
      const sessionId = args[1];
      await memoryManager.clearMemory(sessionId);
      console.log(`✅ Cleared memory for session: ${sessionId}`);
    } else if (action === "export" && args[1]) {
      const sessionId = args[1];
      const exported = await memoryManager.exportMemory(sessionId);
      console.log(exported);
    } else {
      console.error(
        "Usage: agent-cli memory list | memory clear <sessionId> | memory export <sessionId>"
      );
    }
  } catch (error) {
    console.error("❌ Memory operation failed:", error);
  }
}

function handleListAgents(): void {
  const agents = orchestrator.getAllAgents();

  console.log("\n📌 Available Agents:\n");
  agents.forEach((agentId) => {
    const info = orchestrator.getAgentInfo(agentId);
    if (info) {
      console.log(`  ${agentId}: ${info.name}`);
      console.log(`    Role: ${info.role}`);
      console.log(`    Current Model: ${info.model}`);
      console.log();
    }
  });
}

function handleListModels(): void {
  const models = modelSwitcher.listAvailableModels();

  console.log("\n🧠 Available Models:\n");
  models.forEach(({ name, info }) => {
    console.log(`  ${name}: ${info.name}`);
    console.log(`    Speed: ${"⚡".repeat(info.speedRating)} (${info.speedRating}/5)`);
    console.log(`    Cost: ${"💰".repeat(info.costRating)} (${info.costRating}/5)`);
    console.log(`    Best for: ${info.bestFor.join(", ")}`);
    console.log();
  });
}

async function handleRouteTask(): Promise<void> {
  const agents = orchestrator.getAllAgents();

  console.log("\n🤖 Available Agents:");
  agents.forEach((agent, index) => {
    const info = orchestrator.getAgentInfo(agent);
    console.log(`  ${index + 1}. ${info?.name} (${agent})`);
  });

  // Note: In actual CLI, would use readline for interactive input
  console.log(
    "\nNote: For interactive mode, run with parameters or use the API."
  );
}

async function main(): Promise<void> {
  const { command, args } = parseArgs();

  try {
    switch (command) {
      case "status":
        await handleStatus();
        break;
      case "switch":
        await handleSwitch(args);
        break;
      case "memory":
        await handleMemory(args);
        break;
      case "list-agents":
        handleListAgents();
        break;
      case "list-models":
        handleListModels();
        break;
      case "route-task":
        await handleRouteTask();
        break;
      case "help":
        printHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
