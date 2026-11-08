import { memoryManager, type SessionMemory } from "./memory";

export interface TopicCluster {
  topic: string;
  keywords: string[];
  frequency: number;
  lastMentioned: Date;
}

export interface DecisionLink {
  relatedSessionId: string;
  relatedAgentId: string;
  similarity: number;
  topic: string;
}

export interface SemanticMemory extends SessionMemory {
  semanticTags: string[];
  topics: TopicCluster[];
  relatedDecisions: DecisionLink[];
  confidence: number;
  lastAccessed: Date;
}

export interface MemoryInsights {
  topTopics: string[];
  frequentThemes: Record<string, number>;
  relatedMemories: number;
  memoryAge: number;
}

export interface MemorySearchResult {
  sessionId: string;
  agentId: string;
  similarity: number;
  relevantDecisions: string[];
}

export class SemanticMemoryManager extends memoryManager.constructor {
  private tagIndex: Map<string, Set<string>> = new Map();
  private topicIndex: Map<string, Set<string>> = new Map();

  async addSemanticTags(
    sessionId: string,
    agentId: string,
    tags: string[]
  ): Promise<void> {
    try {
      const memory = await memoryManager.loadMemory(sessionId, agentId);
      if (memory) {
        const semanticMemory = memory as SemanticMemory;
        semanticMemory.semanticTags = Array.from(
          new Set([...semanticMemory.semanticTags, ...tags])
        );
        semanticMemory.lastAccessed = new Date();

        // Update index
        for (const tag of tags) {
          if (!this.tagIndex.has(tag)) {
            this.tagIndex.set(tag, new Set());
          }
          this.tagIndex.get(tag)!.add(`${sessionId}-${agentId}`);
        }

        await memoryManager.saveMemory(sessionId, agentId, semanticMemory);
      }
    } catch (error) {
      console.error(`Failed to add semantic tags for ${agentId}:`, error);
    }
  }

  async findRelatedMemories(sessionId: string, topic: string): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];

    // Search by topic keywords
    const keywords = this.tokenize(topic);

    // Build similarity scoring
    for (const [tag, memories] of this.tagIndex) {
      for (const memoryKey of memories) {
        if (memoryKey.startsWith(sessionId)) continue;

        const similarity = this.calculateSimilarity(keywords, [tag]);
        if (similarity > 0.5) {
          const [memSessionId, memAgentId] = memoryKey.split("-");
          results.push({
            sessionId: memSessionId,
            agentId: memAgentId,
            similarity,
            relevantDecisions: [tag],
          });
        }
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  async searchMemory(query: string, sessionId: string): Promise<MemorySearchResult[]> {
    const queryKeywords = this.tokenize(query);
    const results: MemorySearchResult[] = [];

    // Search across all tagged memories
    for (const [tag, memories] of this.tagIndex) {
      const tagKeywords = this.tokenize(tag);
      const similarity = this.calculateSimilarity(queryKeywords, tagKeywords);

      if (similarity > 0.4) {
        for (const memoryKey of memories) {
          const [memSessionId, memAgentId] = memoryKey.split("-");
          const existingResult = results.find(
            (r) => r.sessionId === memSessionId && r.agentId === memAgentId
          );

          if (existingResult) {
            existingResult.similarity = Math.max(existingResult.similarity, similarity);
            existingResult.relevantDecisions.push(tag);
          } else {
            results.push({
              sessionId: memSessionId,
              agentId: memAgentId,
              similarity,
              relevantDecisions: [tag],
            });
          }
        }
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
  }

  async getMemoryInsights(sessionId: string): Promise<MemoryInsights> {
    const insights: MemoryInsights = {
      topTopics: [],
      frequentThemes: {},
      relatedMemories: 0,
      memoryAge: 0,
    };

    try {
      // Collect all tags and topics from this session
      const topicFrequency: Record<string, number> = {};

      for (const [tag, memories] of this.tagIndex) {
        for (const memoryKey of memories) {
          if (memoryKey.startsWith(sessionId)) {
            topicFrequency[tag] = (topicFrequency[tag] || 0) + 1;
          }
        }
      }

      insights.topTopics = Object.entries(topicFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic]) => topic);

      insights.frequentThemes = topicFrequency;

      // Count related memories
      for (const memories of this.tagIndex.values()) {
        insights.relatedMemories += memories.size;
      }

      return insights;
    } catch (error) {
      console.error("Failed to get memory insights:", error);
      return insights;
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 2 && !this.isStopword(word));
  }

  private isStopword(word: string): boolean {
    const stopwords = new Set([
      "the",
      "and",
      "or",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "a",
      "an",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
    ]);
    return stopwords.has(word);
  }

  private calculateSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    // Jaccard similarity
    return intersection.size / union.size;
  }

  extractSemanticTags(text: string, limit: number = 10): string[] {
    // Simple extraction: capitalize words as potential tags
    const words = text.split(/\s+/);
    const tags: string[] = [];

    for (const word of words) {
      const cleaned = word
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/^-+|-+$/g, "");

      if (cleaned.length > 3 && !this.isStopword(cleaned)) {
        tags.push(cleaned);
      }

      if (tags.length >= limit) break;
    }

    return Array.from(new Set(tags));
  }

  async buildTopicClusters(sessionId: string): Promise<TopicCluster[]> {
    const clusters: TopicCluster[] = [];
    const topicFrequency: Record<string, string[]> = {};

    for (const [tag, memories] of this.tagIndex) {
      for (const memoryKey of memories) {
        if (memoryKey.startsWith(sessionId)) {
          if (!topicFrequency[tag]) {
            topicFrequency[tag] = [];
          }
          topicFrequency[tag].push(memoryKey);
        }
      }
    }

    for (const [topic, memories] of Object.entries(topicFrequency)) {
      clusters.push({
        topic,
        keywords: this.tokenize(topic),
        frequency: memories.length,
        lastMentioned: new Date(),
      });
    }

    return clusters.sort((a, b) => b.frequency - a.frequency);
  }
}

export const semanticMemoryManager = new SemanticMemoryManager();
