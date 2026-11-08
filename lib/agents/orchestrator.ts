import { Anthropic } from '@anthropic-ai/sdk';
import { AGENT_CONFIGS, AgentConfig } from './config';

export interface Message {
  role: 'user' | 'assistant';
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
    history.push({ role: 'user', content: task });

    const response = await this.client.messages.create({
      model: config.model,
      max_tokens: 2048,
      system: config.systemPrompt,
      messages: history,
    });

    const assistantMessage =
      response.content[0].type === 'text' ? response.content[0].text : '';

    history.push({ role: 'assistant', content: assistantMessage });
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
          role: 'user',
          content: 'You are now activated. Ready to help with your expertise.',
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
