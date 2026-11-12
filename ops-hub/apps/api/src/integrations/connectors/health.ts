export interface ConnectorHealth {
  name: string;
  lastSuccessAt: Date | null;
  lastError: string | null;
  tokenExpiresAt: Date | null;
  errorRate: number;
}

export class ConnectorHealthTracker {
  private readonly map = new Map<string, ConnectorHealth>();

  private get(name: string): ConnectorHealth {
    if (!this.map.has(name)) {
      this.map.set(name, {
        name,
        lastSuccessAt: null,
        lastError: null,
        tokenExpiresAt: null,
        errorRate: 0,
      });
    }
    return this.map.get(name)!;
  }

  recordSuccess(name: string): void {
    const h = this.get(name);
    h.lastSuccessAt = new Date();
    h.lastError = null;
  }

  recordError(name: string, error: string): void {
    const h = this.get(name);
    h.lastError = error;
    h.errorRate = Math.min(1, h.errorRate + 0.1);
  }

  isStale(name: string, thresholdMinutes: number): boolean {
    const h = this.get(name);
    if (!h.lastSuccessAt) return true;
    const mins = (Date.now() - h.lastSuccessAt.getTime()) / 60000;
    return mins > thresholdMinutes;
  }
}
