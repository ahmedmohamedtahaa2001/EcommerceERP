export type RiskTier = "low" | "medium" | "high";

export class RiskScoringService {
  score(
    _tenantId: string,
    _orderId: string,
  ): { tier: RiskTier; reasons: string[] } {
    return { tier: "low", reasons: [] };
  }
}
