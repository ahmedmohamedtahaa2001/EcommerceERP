export type ReturnStatus =
  | "requested"
  | "approved"
  | "label_issued"
  | "in_transit_back"
  | "received"
  | "inspected"
  | "dispositioned"
  | "closed";

export class ReturnsService {
  async createReturn(_tenantId: string, _orderId: string, _lines: unknown[]) {
    return { id: "return-placeholder", status: "requested" as ReturnStatus };
  }
  async receiveReturn(
    _tenantId: string,
    _returnId: string,
    _disposition: string,
  ) {
    return { ok: true };
  }
  async approveRefund(
    _tenantId: string,
    _returnId: string,
    _amountMinor: number,
    _approverId: string,
  ) {
    return { approved: true };
  }
}
