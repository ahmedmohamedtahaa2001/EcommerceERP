import { describe, expect, it } from "vitest";

import { appendOutboxEvent, type Queryable } from "../src/index";

class RecordingClient implements Queryable {
  readonly calls: { text: string; values: unknown[] | undefined }[] = [];

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    return { rows: [] };
  }
}

describe("appendOutboxEvent", () => {
  it("inserts one row with the tenant, event type, and JSON-stringified payload", async () => {
    const client = new RecordingClient();

    await appendOutboxEvent(client, {
      tenantId: "tenant-1",
      eventType: "product.created",
      payload: { id: "product-1", nameEn: "Shirt" },
    });

    expect(client.calls).toHaveLength(1);
    const [call] = client.calls;
    expect(call!.text).toContain("insert into outbox_events");
    expect(call!.values).toEqual([
      "tenant-1",
      "product.created",
      JSON.stringify({ id: "product-1", nameEn: "Shirt" }),
    ]);
  });
});
