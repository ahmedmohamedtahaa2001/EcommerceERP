export interface ShopifyOutboundConfig {
  shop: string;
  accessToken: string;
}

export class ShopifyOutbound {
  constructor(private readonly config: ShopifyOutboundConfig) {}

  async pushInventory(_variantId: string, _available: number): Promise<void> {
    // placeholder
  }

  async writeFulfillment(
    _orderId: string,
    _trackingNumber: string,
  ): Promise<void> {
    // placeholder
  }
}
