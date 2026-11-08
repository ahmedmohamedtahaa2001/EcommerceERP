import { AGENT_CONFIGS } from "./config";

type ModelName = "opus-5-5" | "sonnet-5-5" | "haiku-5-5";

interface ModelInfo {
  name: string;
  capabilities: string[];
  speedRating: number; // 1-5, 5 being fastest
  costRating: number; // 1-5, 5 being most expensive
  bestFor: string[];
}

const MODEL_INFO: Record<ModelName, ModelInfo> = {
  "opus-5-5": {
    name: "Claude Opus 5.5",
    capabilities: [
      "Complex reasoning",
      "Code generation",
      "Analysis",
      "Multi-step tasks",
    ],
    speedRating: 2,
    costRating: 5,
    bestFor: [
      "Architecture design",
      "Complex problem solving",
      "Code review",
      "Research",
    ],
  },
  "sonnet-5-5": {
    name: "Claude Sonnet 5.5",
    capabilities: [
      "Balanced performance",
      "General tasks",
      "Code generation",
      "Analysis",
    ],
    speedRating: 3,
    costRating: 3,
    bestFor: ["General development", "API design", "Documentation", "Testing"],
  },
  "haiku-5-5": {
    name: "Claude Haiku 5.5",
    capabilities: ["Fast responses", "Simple tasks", "Lightweight operations"],
    speedRating: 5,
    costRating: 1,
    bestFor: ["Simple tasks", "Monitoring", "Logs analysis", "Quick answers"],
  },
};

export class ModelSwitcher {
  /**
   * Switch model for a specific agent
   */
  switchAgentModel(agentId: string, model: ModelName): boolean {
    const config = AGENT_CONFIGS[agentId];
    if (!config) {
      console.error(`Agent ${agentId} not found`);
      return false;
    }

    const previousModel = config.model;
    config.model = model;

    console.log(`✓ Switched ${config.name}`);
    console.log(`  From: ${previousModel} → To: ${model}`);

    return true;
  }

  /**
   * Switch all agents to the same model
   */
  switchAllAgents(model: ModelName): void {
    const agents = Object.keys(AGENT_CONFIGS);
    let switched = 0;

    for (const agentId of agents) {
      if (this.switchAgentModel(agentId, model)) {
        switched++;
      }
    }

    console.log(`✓ Switched ${switched}/${agents.length} agents to ${model}`);
  }

  /**
   * Get current model for an agent
   */
  getAgentModel(agentId: string): ModelName | null {
    const config = AGENT_CONFIGS[agentId];
    return config ? config.model : null;
  }

  /**
   * Get all current agent models
   */
  getAllModels(): Record<string, ModelName> {
    const result: Record<string, ModelName> = {};
    Object.entries(AGENT_CONFIGS).forEach(([id, config]) => {
      result[id] = config.model;
    });
    return result;
  }

  /**
   * Get model information
   */
  getModelInfo(model: ModelName): ModelInfo {
    return MODEL_INFO[model];
  }

  /**
   * List available models
   */
  listAvailableModels(): Array<{
    name: ModelName;
    info: ModelInfo;
  }> {
    return Object.entries(MODEL_INFO).map(([name, info]) => ({
      name: name as ModelName,
      info,
    }));
  }

  /**
   * Recommend model based on use case
   */
  recommendModel(useCase: string): ModelName {
    const lowercaseCase = useCase.toLowerCase();

    // Check if matches Opus use cases
    if (
      MODEL_INFO["opus-5-5"].bestFor.some((uc) =>
        lowercaseCase.includes(uc.toLowerCase())
      )
    ) {
      return "opus-5-5";
    }

    // Check if matches Haiku use cases
    if (
      MODEL_INFO["haiku-5-5"].bestFor.some((uc) =>
        lowercaseCase.includes(uc.toLowerCase())
      )
    ) {
      return "haiku-5-5";
    }

    // Default to Sonnet
    return "sonnet-5-5";
  }

  /**
   * Get all agents current state
   */
  getAgentStatus(): Array<{
    agentId: string;
    name: string;
    currentModel: ModelName;
    modelInfo: ModelInfo;
  }> {
    return Object.entries(AGENT_CONFIGS).map(([agentId, config]) => ({
      agentId,
      name: config.name,
      currentModel: config.model,
      modelInfo: MODEL_INFO[config.model],
    }));
  }

  /**
   * Print formatted status
   */
  printStatus(): void {
    const status = this.getAgentStatus();

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║           AGENT TEAMS - MODEL STATUS                     ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    status.forEach((agent) => {
      console.log(`📌 ${agent.name}`);
      console.log(
        `   Role: ${AGENT_CONFIGS[agent.agentId]?.role || "Unknown"}`
      );
      console.log(`   Model: ${agent.currentModel}`);
      console.log(`   Speed: ${"⚡".repeat(agent.modelInfo.speedRating)} (${agent.modelInfo.speedRating}/5)`);
      console.log(`   Cost: ${"💰".repeat(agent.modelInfo.costRating)} (${agent.modelInfo.costRating}/5)`);
      console.log(`   Best for: ${agent.modelInfo.bestFor.join(", ")}`);
      console.log();
    });
  }

  /**
   * Get cost estimation for all agents
   */
  getEstimatedCost(): {
    cheap: string[];
    moderate: string[];
    expensive: string[];
  } {
    const status = this.getAgentStatus();
    const cheap: string[] = [];
    const moderate: string[] = [];
    const expensive: string[] = [];

    status.forEach((agent) => {
      if (agent.modelInfo.costRating <= 2) {
        cheap.push(agent.agentId);
      } else if (agent.modelInfo.costRating <= 3) {
        moderate.push(agent.agentId);
      } else {
        expensive.push(agent.agentId);
      }
    });

    return { cheap, moderate, expensive };
  }
}

export const modelSwitcher = new ModelSwitcher();
