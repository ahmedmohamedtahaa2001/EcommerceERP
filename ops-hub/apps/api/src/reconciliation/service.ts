export class ReconciliationService {
  async dailyReconcile(_tenantId: string, _date: Date) {
    return { matched: 0, unmatched: 0, varianceMinor: 0 };
  }
  async importSettlement(
    _tenantId: string,
    _fileHash: string,
    _lines: unknown[],
  ) {
    return { imported: true, duplicates: 0 };
  }
}
