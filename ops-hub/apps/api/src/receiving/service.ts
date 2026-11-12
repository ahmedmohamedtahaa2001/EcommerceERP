export interface ReceiptLine {
  sku: string;
  expectedQty: number;
  receivedQty: number;
  damagedQty: number;
}

export class ReceivingService {
  async createReceipt(
    _tenantId: string,
    _poId: string | null,
    _lines: ReceiptLine[],
  ) {
    // placeholder: creates receipt with lines into quarantined
    return { id: "receipt-placeholder", lines: _lines };
  }
  async verifyAndRelease(
    _tenantId: string,
    _receiptId: string,
    _sku: string,
    _qty: number,
    _binCode: string,
  ) {
    // placeholder
    return { released: true };
  }
  async suggestPutaway(_tenantId: string, _sku: string) {
    return { binCode: "A-01", reason: "nearest free bin" };
  }
}
