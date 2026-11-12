export interface SettlementLine {
  trackingNumber: string;
  orderRef?: string;
  amountMinor: number;
  currency: string;
  deductionType?:
    "delivery_fee" | "return_fee" | "cod_commission" | "storage" | "other";
}

export interface SettlementImportResult {
  matched: number;
  unmatched: number;
  totalVarianceMinor: number;
  unmatchedLines: SettlementLine[];
}

export function parseSettlementCsv(text: string): SettlementLine[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0]?.split(",") ?? [];
  const idx = (name: string) => header.findIndex((h) => h.trim() === name);
  const ti = idx("tracking");
  const ai = idx("amount");
  const ci = idx("currency");
  const out: SettlementLine[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(",");
    if (cols.length < 2) continue;
    out.push({
      trackingNumber: (cols[ti] ?? "").trim(),
      amountMinor: parseInt((cols[ai] ?? "").trim() || "0", 10) || 0,
      currency: (cols[ci] ?? "").trim() || "EGP",
    });
  }
  return out;
}

export function reconcileSettlement(
  lines: SettlementLine[],
  knownTracking: Set<string>,
): SettlementImportResult {
  let matched = 0;
  let unmatched = 0;
  const unmatchedLines: SettlementLine[] = [];
  let totalVarianceMinor = 0;
  for (const line of lines) {
    if (knownTracking.has(line.trackingNumber)) {
      matched++;
    } else {
      unmatched++;
      unmatchedLines.push(line);
      totalVarianceMinor += line.amountMinor;
    }
  }
  return { matched, unmatched, totalVarianceMinor, unmatchedLines };
}
