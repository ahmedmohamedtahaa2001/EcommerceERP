import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/agents/orchestrator';
import { memoryManager } from '@/lib/agents/memory';

export async function POST(request: NextRequest) {
  try {
    const { task, agent, sessionId } = await request.json();

    if (!task || !agent || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: task, agent, sessionId' },
        { status: 400 }
      );
    }

    // Initialize memory
    await memoryManager.initialize();

    // Load previous context
    const previousMemory = await memoryManager.loadMemory(sessionId, agent);
    const context = previousMemory
      ? `Previous context: ${JSON.stringify(previousMemory.context)}\n\n`
      : '';

    // Route task to agent
    const response = await orchestrator.routeTask(context + task, agent);

    // Save memory for next session
    await memoryManager.saveMemory(sessionId, agent, {
      agentId: agent,
      decisions: previousMemory?.decisions || [],
      context: {
        ...previousMemory?.context,
        lastTask: task,
        lastResponse: response.response.substring(0, 500),
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
    console.error('Agent routing error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
