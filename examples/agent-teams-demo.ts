/**
 * Agent Teams Demo
 *
 * This file demonstrates how to use the Claude Agent Teams system
 * for multi-agent collaboration on complex tasks.
 *
 * Run this with: npx ts-node examples/agent-teams-demo.ts
 */

import { orchestrator } from "@/lib/agents/orchestrator";
import { memoryManager } from "@/lib/agents/memory";
import { modelSwitcher } from "@/lib/agents/model-switcher";

// Demo configuration
const DEMO_SESSION = `demo-${Date.now()}`;

/**
 * Demo 1: Single Agent Task
 */
async function demo1_SingleAgent() {
  console.log("\n" + "=".repeat(60));
  console.log("DEMO 1: Single Agent Task");
  console.log("=".repeat(60));

  const task =
    "Design a REST API endpoint for managing customer orders. Include request/response schemas, error handling, and pagination.";

  console.log(`\n📤 Sending task to Backend Agent...`);
  console.log(`Task: ${task}\n`);

  const response = await orchestrator.routeTask(task, "backend");

  console.log(`✅ Response from ${response.agent}:`);
  console.log(`📊 Model: ${response.model}`);
  console.log(`💾 Tokens: ${response.tokensUsed}`);
  console.log(`\n📝 Response:\n${response.response}`);

  return response;
}

/**
 * Demo 2: Multi-Agent Collaboration
 */
async function demo2_MultiAgentCollaboration() {
  console.log("\n" + "=".repeat(60));
  console.log("DEMO 2: Multi-Agent Collaboration");
  console.log("=".repeat(60));

  const sessionId = `collab-${Date.now()}`;

  const workflows = [
    {
      agent: "backend",
      task:
        "Design the backend architecture for an inventory management system with real-time updates",
    },
    {
      agent: "database",
      task:
        "Based on the inventory management requirements, design an optimal database schema with appropriate indexes",
    },
    {
      agent: "frontend",
      task:
        "Create a React component architecture for displaying and managing inventory in real-time",
    },
    {
      agent: "devops",
      task:
        "Plan the deployment pipeline and infrastructure setup for the inventory system",
    },
  ];

  console.log(
    `\n🔄 Starting multi-agent workflow (Session: ${sessionId})...\n`
  );

  const results = [];

  for (const workflow of workflows) {
    console.log(
      `\n📤 Routing task to ${workflow.agent.toUpperCase()} Agent...`
    );
    console.log(`Task: ${workflow.task.substring(0, 60)}...\n`);

    const response = await orchestrator.routeTask(workflow.task, workflow.agent);

    console.log(`✅ ${response.agent}`);
    console.log(`   Model: ${response.model}`);
    console.log(`   Tokens: ${response.tokensUsed}`);
    console.log(`   Response: ${response.response.substring(0, 100)}...`);

    results.push({
      agent: workflow.agent,
      response,
    });

    // Small delay between agents to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n✨ All agents completed!`);
  return results;
}

/**
 * Demo 3: Memory Persistence
 */
async function demo3_MemoryPersistence() {
  console.log("\n" + "=".repeat(60));
  console.log("DEMO 3: Memory Persistence");
  console.log("=".repeat(60));

  const sessionId = `memory-${Date.now()}`;

  await memoryManager.initialize();

  console.log(`\n📝 Session: ${sessionId}`);

  // First task
  console.log(
    "\n1️⃣ First task - Backend agent designs an API\n"
  );

  const task1 =
    "Design a product catalog API with filtering and search capabilities";

  const response1 = await orchestrator.routeTask(task1, "backend");

  // Save memory
  await memoryManager.saveMemory(sessionId, "backend", {
    agentId: "backend",
    decisions: [
      "Use REST with JSON responses",
      "Implement filtering with query parameters",
      "Add full-text search capability",
    ],
    context: {
      projectType: "e-commerce",
      apiVersion: "v1",
      authentication: "JWT",
    },
    sharedKnowledge: {
      database: "PostgreSQL",
      caching: "Redis",
    },
  });

  console.log(`✅ First task completed and memory saved`);

  // Second task - with context from memory
  console.log(
    "\n2️⃣ Second task - Optimize queries using previous context\n"
  );

  const loadedMemory = await memoryManager.loadMemory(sessionId, "backend");

  const task2 = `Previous decisions: ${JSON.stringify(loadedMemory?.decisions)}
Previous context: ${JSON.stringify(loadedMemory?.context)}

Now optimize the database queries for the product catalog API with proper indexing strategy.`;

  const response2 = await orchestrator.routeTask(task2, "database");

  console.log(`✅ Second task completed with previous context`);

  // Save stats
  const stats = await memoryManager.getSessionStats(sessionId);

  console.log(`\n📊 Session Statistics:`);
  console.log(`   Session ID: ${stats.sessionId}`);
  console.log(`   Agents Used: ${stats.agentCount}`);
  console.log(`   Memory Size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
  console.log(`   Last Updated: ${stats.lastUpdated}`);

  return { response1, response2, stats };
}

/**
 * Demo 4: Model Switching
 */
async function demo4_ModelSwitching() {
  console.log("\n" + "=".repeat(60));
  console.log("DEMO 4: Model Switching");
  console.log("=".repeat(60));

  console.log(`\n📋 Current Agent Status:\n`);
  modelSwitcher.printStatus();

  console.log(`\n🔄 Switching all agents to Sonnet 5.5...\n`);
  modelSwitcher.switchAllAgents("sonnet-5-5");

  console.log(`\n✅ New Status:\n`);
  modelSwitcher.printStatus();

  console.log(`\n💰 Cost Estimation:\n`);
  const costs = modelSwitcher.getEstimatedCost();
  console.log(`   Cheap: ${costs.cheap.join(", ")}`);
  console.log(`   Moderate: ${costs.moderate.join(", ")}`);
  console.log(`   Expensive: ${costs.expensive.join(", ")}`);

  // Reset to original
  console.log(`\n🔄 Resetting to original configuration...\n`);
  modelSwitcher.switchAgentModel("backend", "opus-5-5");
  modelSwitcher.switchAgentModel("frontend", "sonnet-5-5");
  modelSwitcher.switchAgentModel("database", "sonnet-5-5");
  modelSwitcher.switchAgentModel("devops", "haiku-5-5");

  console.log(`✅ Reset complete`);
}

/**
 * Demo 5: Full Workflow
 */
async function demo5_FullWorkflow() {
  console.log("\n" + "=".repeat(60));
  console.log("DEMO 5: Complete E-commerce Feature Workflow");
  console.log("=".repeat(60));

  const projectName = "discount-management-system";
  const sessionId = `${projectName}-${Date.now()}`;

  await memoryManager.initialize();

  console.log(`\n🎯 Project: ${projectName}`);
  console.log(`📝 Session: ${sessionId}\n`);

  // Save shared context
  await memoryManager.saveSharedMemory(sessionId, {
    projectName,
    businessGoal: "Implement a flexible discount management system",
    constraints: [
      "Must handle multiple discount types (percentage, fixed, tiered)",
      "Performance critical - hundreds of calculations per second",
      "Must support real-time updates",
    ],
    timeline: "2 weeks",
  });

  const agents = ["backend", "database", "frontend", "devops"];
  const tasks = {
    backend:
      "Design the discount engine API that handles: percentage discounts, fixed amount discounts, tiered discounts, and bulk pricing",
    database:
      "Design the database schema for storing discount rules, categories, and audit logs with efficient querying",
    frontend:
      "Create a UI for administrators to create and manage discount rules with real-time preview",
    devops:
      "Plan the deployment and monitoring for the discount system including load testing",
  };

  console.log(`🚀 Starting agent team workflow...\n`);

  const results = [];

  for (const agent of agents) {
    const task = tasks[agent as keyof typeof tasks];

    console.log(`📤 ${agent.toUpperCase()} Agent:`);
    console.log(`   Task: ${task.substring(0, 60)}...`);

    const response = await orchestrator.routeTask(task, agent);

    await memoryManager.saveMemory(sessionId, agent, {
      agentId: agent,
      decisions: [
        "Task completed successfully",
        `Response length: ${response.response.length}`,
      ],
      context: {
        taskStartTime: new Date().toISOString(),
        tokensUsed: response.tokensUsed,
      },
      sharedKnowledge: {
        projectName,
        status: "in_progress",
      },
    });

    results.push({
      agent,
      tokensUsed: response.tokensUsed,
      responseLength: response.response.length,
    });

    console.log(
      `   ✅ Completed (${response.tokensUsed} tokens, ${response.model})\n`
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n📊 Workflow Summary:`);
  console.log(`   Project: ${projectName}`);
  console.log(`   Agents: ${results.length}`);

  let totalTokens = 0;
  results.forEach((r) => {
    console.log(`   ${r.agent}: ${r.tokensUsed} tokens`);
    totalTokens += r.tokensUsed;
  });

  console.log(`   Total Tokens: ${totalTokens}`);

  const stats = await memoryManager.getSessionStats(sessionId);
  console.log(`   Memory Size: ${(stats.totalSize / 1024).toFixed(2)} KB`);

  return { results, sessionId };
}

/**
 * Run all demos
 */
async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     Claude Agent Teams - Comprehensive Demo               ║
╚════════════════════════════════════════════════════════════╝
  `);

  try {
    // Initialize memory
    await memoryManager.initialize();

    // Run demos
    console.log(
      "\nSelect demos to run (requires ANTHROPIC_API_KEY in .env):\n"
    );
    console.log(
      "Choose which demos to run by commenting/uncommenting below:"
    );

    // Uncomment to run specific demos:

    // await demo1_SingleAgent();
    // await demo2_MultiAgentCollaboration();
    // await demo3_MemoryPersistence();
    // await demo4_ModelSwitching();
    // await demo5_FullWorkflow();

    console.log(`\n${"=".repeat(60)}`);
    console.log("✨ To run demos, set ANTHROPIC_API_KEY and uncomment demo calls");
    console.log(`${"=".repeat(60)}\n`);
  } catch (error) {
    console.error("❌ Error running demo:", error);
    process.exit(1);
  }
}

// Uncomment to run:
// main();

export {
  demo1_SingleAgent,
  demo2_MultiAgentCollaboration,
  demo3_MemoryPersistence,
  demo4_ModelSwitching,
  demo5_FullWorkflow,
};
