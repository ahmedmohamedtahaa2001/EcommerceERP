export interface Recommendation {
  text: string;
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  impact?: "high" | "medium" | "low";
}

export interface ActionItem {
  description: string;
  owner?: string;
  dueDate?: string;
  priority: "high" | "medium" | "low";
}

export interface Risk {
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  mitigation?: string;
}

export interface Estimation {
  item: string;
  value: number;
  unit: string;
  confidence: number;
}

export interface ParsedResponse {
  summary: string;
  recommendations: Recommendation[];
  metrics: Record<string, number | string>;
  actionItems: ActionItem[];
  risks: Risk[];
  estimations: Estimation[];
  rawResponse: string;
}

export class ResponseParser {
  parseAgentResponse(rawResponse: string): ParsedResponse {
    return {
      summary: this.extractSummary(rawResponse),
      recommendations: this.extractRecommendations(rawResponse),
      metrics: this.extractMetrics(rawResponse),
      actionItems: this.extractActionItems(rawResponse),
      risks: this.extractRisks(rawResponse),
      estimations: this.extractEstimations(rawResponse),
      rawResponse,
    };
  }

  private extractSummary(text: string): string {
    // Extract the first meaningful paragraph as summary
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    return lines[0] || "No summary available";
  }

  private extractRecommendations(text: string): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Match "Recommendation:" or "Recommend:" patterns
    const recPatterns = [
      /(?:recommendation|recommend|suggest|consider)s?:?\s*([^\n]+)/gi,
      /[-•]\s*(.+?(?:high|medium|low)\s*(?:priority|effort|impact)?.*?)(?:\n|$)/gi,
    ];

    for (const pattern of recPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const text = match[1].trim();
        if (text.length > 10) {
          recommendations.push({
            text: this.cleanText(text),
            priority: this.extractPriority(text),
            effort: this.extractEffort(text),
            impact: this.extractImpact(text),
          });
        }
      }
    }

    return recommendations.slice(0, 10); // Limit to 10
  }

  private extractMetrics(text: string): Record<string, number | string> {
    const metrics: Record<string, number | string> = {};

    // Match "metric: value" patterns
    const metricPattern =
      /([a-z\s]+?):\s*([\d.,]+%?|[\d.,]+\s*(?:days?|hours?|minutes?|seconds?|ms|KB|MB|GB|units?|items?|orders?|customers?))/gi;

    let match;
    while ((match = metricPattern.exec(text)) !== null) {
      const key = this.toSnakeCase(match[1].trim());
      const value = match[2].trim();
      if (key.length > 2) {
        metrics[key] = isNaN(parseFloat(value)) ? value : parseFloat(value);
      }
    }

    return metrics;
  }

  private extractActionItems(text: string): ActionItem[] {
    const items: ActionItem[] = [];

    // Match "Action item:" or "Task:" patterns
    const actionPattern =
      /(?:action item|task|todo|to do|step|implement)s?:?\s*([^\n]+)/gi;

    let match;
    while ((match = actionPattern.exec(text)) !== null) {
      const description = this.cleanText(match[1]);
      if (description.length > 5) {
        items.push({
          description,
          priority: this.extractPriority(description),
        });
      }
    }

    return items.slice(0, 8);
  }

  private extractRisks(text: string): Risk[] {
    const risks: Risk[] = [];

    // Match "Risk:", "Warning:", "Danger:" patterns
    const riskPattern =
      /(?:risk|warning|danger|threat|concern|issue|problem)s?:?\s*([^\n]+)/gi;

    let match;
    while ((match = riskPattern.exec(text)) !== null) {
      const description = this.cleanText(match[1]);
      if (description.length > 5) {
        risks.push({
          description,
          severity: this.extractSeverity(description),
          mitigation: this.extractMitigation(text, description),
        });
      }
    }

    return risks.slice(0, 5);
  }

  private extractEstimations(text: string): Estimation[] {
    const estimations: Estimation[] = [];

    // Match "Estimate:", "Estimation:", patterns with numbers
    const estPattern =
      /(?:estim(?:ate|ation)|forecast|project|expect)s?:?\s*([^\n]+?(?:\d+[.,]\d+|\d+)\s*(?:days?|hours?|weeks?|months?|MB|GB|units?|%|items?))/gi;

    let match;
    while ((match = estPattern.exec(text)) !== null) {
      const text = match[1].trim();
      const numberMatch = text.match(/([\d.,]+)\s*(\w+)/);

      if (numberMatch) {
        estimations.push({
          item: text.replace(/[\d.,\s]/g, "").trim() || "estimation",
          value: parseFloat(numberMatch[1]),
          unit: numberMatch[2],
          confidence: 0.7,
        });
      }
    }

    return estimations.slice(0, 5);
  }

  private extractPriority(
    text: string
  ): "high" | "medium" | "low" {
    const lower = text.toLowerCase();
    if (lower.includes("critical") || lower.includes("high")) return "high";
    if (lower.includes("low")) return "low";
    return "medium";
  }

  private extractEffort(text: string): "low" | "medium" | "high" {
    const lower = text.toLowerCase();
    if (lower.includes("simple") || lower.includes("easy") || lower.includes("low effort"))
      return "low";
    if (lower.includes("complex") || lower.includes("difficult") || lower.includes("high effort"))
      return "high";
    return "medium";
  }

  private extractImpact(text: string): "high" | "medium" | "low" | undefined {
    const lower = text.toLowerCase();
    if (lower.includes("high impact") || lower.includes("significant")) return "high";
    if (lower.includes("low impact")) return "low";
    if (lower.includes("medium impact")) return "medium";
    return undefined;
  }

  private extractSeverity(text: string): "critical" | "high" | "medium" | "low" {
    const lower = text.toLowerCase();
    if (lower.includes("critical")) return "critical";
    if (lower.includes("high") || lower.includes("severe")) return "high";
    if (lower.includes("medium") || lower.includes("moderate")) return "medium";
    return "low";
  }

  private extractMitigation(fullText: string, riskDescription: string): string | undefined {
    // Look for mitigation immediately after risk
    const riskIndex = fullText.toLowerCase().indexOf(riskDescription.toLowerCase());
    if (riskIndex === -1) return undefined;

    const afterRisk = fullText.substring(riskIndex + riskDescription.length, riskIndex + 200);
    const mitigationMatch = afterRisk.match(/(?:mitigation|solution|fix|prevent)s?:?\s*([^\n]+)/i);

    return mitigationMatch ? this.cleanText(mitigationMatch[1]) : undefined;
  }

  private toSnakeCase(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  private cleanText(text: string): string {
    return text
      .replace(/^[-•]\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 200);
  }
}

export const responseParser = new ResponseParser();
