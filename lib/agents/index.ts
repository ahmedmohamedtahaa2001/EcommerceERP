// Export all agent-related modules
export * from "./config";
export * from "./orchestrator";
export * from "./memory";
export * from "./model-switcher";

// Phase 1: ERP Integration
export * from "./epr-prompts";
export * from "./epr-data-access";
export { erpDataAccess } from "./epr-data-access";

// Phase 3: Response & Memory Enhancement
export * from "./response-parser";
export * from "./semantic-memory";
export * from "./knowledge-graph";

// Workflows
export * from "./workflows/epr-workflows";
export { erpWorkflows } from "./workflows/epr-workflows";

// Export singletons
export { orchestrator } from "./orchestrator";
export { memoryManager } from "./memory";
export { modelSwitcher } from "./model-switcher";
export { responseParser } from "./response-parser";
export { semanticMemoryManager } from "./semantic-memory";
export { knowledgeGraphManager } from "./knowledge-graph";
