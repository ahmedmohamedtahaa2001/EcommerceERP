import fs from "fs/promises";
import path from "path";

export interface KnowledgeNode {
  id: string;
  label: string;
  category: "technology" | "business" | "pattern" | "risk" | "optimization";
  description: string;
  relatedConcepts: string[];
  frequency: number;
  lastUpdated: Date;
}

export interface KnowledgeEdge {
  fromId: string;
  toId: string;
  relationship: "causes" | "related-to" | "improves" | "conflicts-with" | "depends-on";
  strength: number; // 0-1
}

export interface KnowledgeCluster {
  id: string;
  name: string;
  nodes: KnowledgeNode[];
  density: number;
  importance: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  clusters: KnowledgeCluster[];
  lastUpdated: Date;
}

export class KnowledgeGraphManager {
  private knowledgeDir = path.join(process.cwd(), ".claude", "knowledge-graph");
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();
  private clusters: Map<string, KnowledgeCluster> = new Map();

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.knowledgeDir, { recursive: true });
      await this.loadGraph();
    } catch (error) {
      console.error("Failed to initialize knowledge graph:", error);
    }
  }

  async addConcept(concept: string, category: KnowledgeNode["category"], description?: string): Promise<void> {
    try {
      const id = this.sanitizeId(concept);
      if (this.nodes.has(id)) {
        const node = this.nodes.get(id)!;
        node.frequency += 1;
        node.lastUpdated = new Date();
      } else {
        this.nodes.set(id, {
          id,
          label: concept,
          category,
          description: description || "",
          relatedConcepts: [],
          frequency: 1,
          lastUpdated: new Date(),
        });
      }
      await this.saveGraph();
    } catch (error) {
      console.error("Failed to add concept:", error);
    }
  }

  async linkConcepts(
    fromConcept: string,
    toConcept: string,
    relationship: KnowledgeEdge["relationship"]
  ): Promise<void> {
    try {
      const fromId = this.sanitizeId(fromConcept);
      const toId = this.sanitizeId(toConcept);

      // Ensure both nodes exist
      if (!this.nodes.has(fromId)) {
        await this.addConcept(fromConcept, "pattern", "Auto-created from relationship");
      }
      if (!this.nodes.has(toId)) {
        await this.addConcept(toConcept, "pattern", "Auto-created from relationship");
      }

      // Create edge
      const edgeId = `${fromId}-${relationship}-${toId}`;
      const strength = this.edges.has(edgeId) ? (this.edges.get(edgeId)?.strength || 0) + 0.1 : 0.5;

      this.edges.set(edgeId, {
        fromId,
        toId,
        relationship,
        strength: Math.min(strength, 1),
      });

      // Update related concepts
      const fromNode = this.nodes.get(fromId)!;
      const toNode = this.nodes.get(toId)!;
      if (!fromNode.relatedConcepts.includes(toId)) {
        fromNode.relatedConcepts.push(toId);
      }
      if (!toNode.relatedConcepts.includes(fromId)) {
        toNode.relatedConcepts.push(fromId);
      }

      await this.saveGraph();
    } catch (error) {
      console.error("Failed to link concepts:", error);
    }
  }

  async findPath(
    fromConcept: string,
    toConcept: string,
    maxDepth: number = 3
  ): Promise<KnowledgeEdge[]> {
    const fromId = this.sanitizeId(fromConcept);
    const toId = this.sanitizeId(toConcept);

    const path = this.bfs(fromId, toId, maxDepth);
    return path;
  }

  async getRelatedConcepts(concept: string, depth: number = 2): Promise<string[]> {
    const id = this.sanitizeId(concept);
    const related = new Set<string>();
    const visited = new Set<string>();

    const traverse = (nodeId: string, currentDepth: number) => {
      if (currentDepth === 0 || visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const relatedId of node.relatedConcepts) {
          related.add(relatedId);
          traverse(relatedId, currentDepth - 1);
        }
      }
    };

    traverse(id, depth);
    return Array.from(related).map((id) => this.nodes.get(id)?.label || id);
  }

  async exportGraph(): Promise<KnowledgeGraph> {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      clusters: Array.from(this.clusters.values()),
      lastUpdated: new Date(),
    };
  }

  async getGraphStats(): Promise<{
    nodeCount: number;
    edgeCount: number;
    clusterCount: number;
    averageDegree: number;
  }> {
    const nodeCount = this.nodes.size;
    const edgeCount = this.edges.size;
    const clusterCount = this.clusters.size;
    const averageDegree =
      nodeCount === 0
        ? 0
        : Array.from(this.nodes.values()).reduce((sum, node) => sum + node.relatedConcepts.length, 0) /
          nodeCount;

    return {
      nodeCount,
      edgeCount,
      clusterCount,
      averageDegree,
    };
  }

  private bfs(fromId: string, toId: string, maxDepth: number): KnowledgeEdge[] {
    const queue: [string, KnowledgeEdge[]][] = [[fromId, []]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [currentId, path] = queue.shift()!;

      if (currentId === toId) return path;
      if (visited.has(currentId)) continue;
      if (path.length >= maxDepth) continue;

      visited.add(currentId);

      const edges = Array.from(this.edges.values()).filter(
        (e) => e.fromId === currentId
      );

      for (const edge of edges) {
        queue.push([edge.toId, [...path, edge]]);
      }
    }

    return [];
  }

  private sanitizeId(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "");
  }

  private async saveGraph(): Promise<void> {
    try {
      const graphPath = path.join(this.knowledgeDir, "graph.json");
      const graph: KnowledgeGraph = {
        nodes: Array.from(this.nodes.values()),
        edges: Array.from(this.edges.values()),
        clusters: Array.from(this.clusters.values()),
        lastUpdated: new Date(),
      };
      await fs.writeFile(graphPath, JSON.stringify(graph, null, 2));
    } catch (error) {
      console.error("Failed to save graph:", error);
    }
  }

  private async loadGraph(): Promise<void> {
    try {
      const graphPath = path.join(this.knowledgeDir, "graph.json");
      const data = await fs.readFile(graphPath, "utf-8");
      const graph: KnowledgeGraph = JSON.parse(data);

      this.nodes.clear();
      this.edges.clear();
      this.clusters.clear();

      for (const node of graph.nodes) {
        this.nodes.set(node.id, node);
      }

      for (const edge of graph.edges) {
        const edgeId = `${edge.fromId}-${edge.relationship}-${edge.toId}`;
        this.edges.set(edgeId, edge);
      }

      for (const cluster of graph.clusters) {
        this.clusters.set(cluster.id, cluster);
      }
    } catch (error) {
      // No existing graph, start fresh
      console.log("Starting with empty knowledge graph");
    }
  }

  async buildClusters(): Promise<void> {
    try {
      const clusters: Map<string, Set<string>> = new Map();
      const visited = new Set<string>();

      // Simple clustering: group nodes by category
      for (const node of this.nodes.values()) {
        if (!visited.has(node.id)) {
          const cluster = this.dfs(node.id, visited);
          const clusterId = `cluster_${clusters.size}`;
          clusters.set(clusterId, cluster);
        }
      }

      // Convert to KnowledgeCluster objects
      for (const [id, nodeIds] of clusters) {
        const nodes = Array.from(nodeIds)
          .map((nodeId) => this.nodes.get(nodeId))
          .filter((node): node is KnowledgeNode => !!node);

        const density = this.calculateClusterDensity(nodes);
        const importance = nodes.reduce((sum, node) => sum + node.frequency, 0) / nodes.length;

        this.clusters.set(id, {
          id,
          name: `Cluster: ${nodes[0]?.category}`,
          nodes,
          density,
          importance,
        });
      }

      await this.saveGraph();
    } catch (error) {
      console.error("Failed to build clusters:", error);
    }
  }

  private dfs(startId: string, visited: Set<string>): Set<string> {
    const cluster = new Set<string>();
    const stack = [startId];

    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);
      cluster.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const relatedId of node.relatedConcepts) {
          if (!visited.has(relatedId)) {
            stack.push(relatedId);
          }
        }
      }
    }

    return cluster;
  }

  private calculateClusterDensity(nodes: KnowledgeNode[]): number {
    if (nodes.length < 2) return 1;

    const edgeCount = nodes.reduce((sum, node) => sum + node.relatedConcepts.length, 0) / 2;
    const maxEdges = (nodes.length * (nodes.length - 1)) / 2;

    return edgeCount / maxEdges;
  }
}

export const knowledgeGraphManager = new KnowledgeGraphManager();
