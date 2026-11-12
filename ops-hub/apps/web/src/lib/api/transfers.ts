import { apiFetch } from "./client";

export interface TransferRequest {
  variantId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  reason: string;
}

export interface TransferResult {
  transferId: string;
}

/** `POST /v1/inventory/transfers` → 201: moves on-hand stock from one location to another in one step. */
export function createTransfer(body: TransferRequest): Promise<TransferResult> {
  return apiFetch<TransferResult>("/v1/inventory/transfers", {
    method: "POST",
    body,
  });
}
