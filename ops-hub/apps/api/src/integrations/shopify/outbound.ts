export interface ShopifyOutboundConfig {
  shop: string;
  accessToken: string;
  apiVersion?: string;
}

/**
 * Shopify outbound connector (roadmap P1-S5-T02): pushes inventory
 * availability per variant and writes the fulfillment and tracking number
 * back when the shipment is accepted.
 *
 * The endpoint paths follow Shopify's Admin REST conventions; they are
 * configurable so a different shop version can be targeted without a code
 * change.
 */
export class ShopifyOutbound {
  constructor(private readonly config: ShopifyOutboundConfig) {}

  private get baseUrl(): string {
    const version = this.config.apiVersion ?? "2024-10";
    return `https://${this.config.shop}/admin/api/${version}`;
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      "X-Shopify-Access-Token": this.config.accessToken,
    };
  }

  /** Sets the available inventory for a variant. */
  async pushInventory(
    variantId: string,
    available: number,
    locationId: string,
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/inventory_levels/set.json`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: variantId,
        available,
      }),
    });
    if (!res.ok) {
      throw new Error(`Shopify inventory push failed: ${res.status}`);
    }
  }

  /** Writes the fulfillment and tracking number back to the order. */
  async writeFulfillment(
    orderId: string,
    trackingNumber: string,
    input?: {
      carrier?: string;
      lineItems?: { id: string; quantity: number }[];
    },
  ): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/orders/${orderId}/fulfillments.json`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          fulfillment: {
            tracking_info: {
              tracking_number: trackingNumber,
              ...(input?.carrier !== undefined
                ? { company: input.carrier }
                : {}),
            },
            notify_customer: true,
            ...(input?.lineItems !== undefined
              ? {
                  line_items_by_fulfillment: [
                    { fulfillment_order_items: input.lineItems },
                  ],
                }
              : {}),
          },
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Shopify fulfillment write failed: ${res.status}`);
    }
  }
}
