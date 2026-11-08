import fs from 'fs/promises';
import path from 'path';

export interface SessionMemory {
  agentId: string;
  decisions: string[];
  context: Record<string, unknown>;
  sharedKnowledge: Record<string, unknown>;
}

class MemoryManager {
  private memoryDir = path.join(process.cwd(), '.claude', 'memory');

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize memory directory:', error);
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
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
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
      console.error('Failed to save shared memory:', error);
    }
  }

  async loadSharedMemory(sessionId: string): Promise<Record<string, unknown>> {
    const filePath = path.join(this.memoryDir, `${sessionId}-shared.json`);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
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
        const files = await fs.readdir(this.memoryDir);
        for (const file of files) {
          if (file.startsWith(sessionId)) {
            await fs.unlink(path.join(this.memoryDir, file));
          }
        }
      }
    } catch (error) {
      console.error('Failed to clear memory:', error);
    }
  }
}

export const memoryManager = new MemoryManager();
