import { supabase } from './supabase';

/**
 * Production webhook system for event notifications
 * Supports: Order updates, Customer actions, Inventory alerts, Payments
 */

export type WebhookEvent =
  | 'order.created'
  | 'order.updated'
  | 'order.shipped'
  | 'order.delivered'
  | 'customer.created'
  | 'customer.updated'
  | 'inventory.low_stock'
  | 'inventory.out_of_stock'
  | 'payment.completed'
  | 'payment.failed';

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
  retry_count: number;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  secret: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Register a webhook endpoint
 */
export async function registerWebhook(
  url: string,
  events: WebhookEvent[]
): Promise<WebhookEndpoint | null> {
  try {
    const secret = generateWebhookSecret();

    const { data, error } = await supabase
      .from('webhooks')
      .insert([
        {
          url,
          events,
          active: true,
          secret,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to register webhook:', error);
    return null;
  }
}

/**
 * Unregister a webhook endpoint
 */
export async function unregisterWebhook(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('webhooks')
      .update({ active: false })
      .eq('id', id);

    return !error;
  } catch (error) {
    console.error('Failed to unregister webhook:', error);
    return false;
  }
}

/**
 * Emit a webhook event
 */
export async function emitWebhookEvent(
  event: WebhookEvent,
  data: Record<string, any>
): Promise<void> {
  try {
    // Get active webhook endpoints for this event
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('active', true)
      .filter('events', 'cs', `{${event}}`);

    if (error) throw error;

    if (!webhooks || webhooks.length === 0) {
      console.log(`No webhooks registered for event: ${event}`);
      return;
    }

    // Send to each webhook endpoint
    const promises = webhooks.map(webhook =>
      sendWebhookWithRetry(
        webhook,
        {
          id: `${Date.now()}-${Math.random()}`,
          event,
          timestamp: new Date().toISOString(),
          data,
          retry_count: 0,
        }
      )
    );

    await Promise.allSettled(promises);
  } catch (error) {
    console.error('Failed to emit webhook event:', error);
  }
}

/**
 * Send webhook with retry logic
 */
async function sendWebhookWithRetry(
  webhook: WebhookEndpoint,
  payload: WebhookPayload,
  attempt = 0
): Promise<boolean> {
  try {
    const signature = generateSignature(payload, webhook.secret);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Id': payload.id,
        'X-Webhook-Event': payload.event,
      },
      body: JSON.stringify(payload),
      timeout: 10000, // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error(`Webhook delivery failed (attempt ${attempt + 1}):`, error);

    if (attempt < MAX_RETRIES) {
      // Exponential backoff
      const delay = RETRY_DELAY * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));

      payload.retry_count++;
      return sendWebhookWithRetry(webhook, payload, attempt + 1);
    }

    // Log failed delivery
    await logFailedWebhook(webhook.id, payload);
    return false;
  }
}

/**
 * Log failed webhook delivery
 */
async function logFailedWebhook(webhookId: string, payload: WebhookPayload): Promise<void> {
  try {
    await supabase.from('webhook_logs').insert([
      {
        webhook_id: webhookId,
        event: payload.event,
        status: 'failed',
        retries: payload.retry_count,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (error) {
    console.error('Failed to log webhook failure:', error);
  }
}

/**
 * Generate webhook signature for security
 */
function generateSignature(payload: WebhookPayload, secret: string): string {
  const crypto = require('crypto');
  const message = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

/**
 * Generate secure webhook secret
 */
function generateWebhookSecret(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}
