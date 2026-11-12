/**
 * Fake courier server used by contract tests and local development.
 *
 * Run with:  npx tsx fixtures/courier/server.ts   (or node after build)
 * Listens on PORT (default 4010).
 *
 * Scenario control (per request):
 *   - query `?scenario=timeout`  -> never responds (tests client timeout handling)
 *   - query `?scenario=error5xx` -> 500 with a JSON error body
 *   - header `X-Scenario: duplicate` on create -> returns the same shipment id
 *     as the first create for that idempotency key (tests idempotency)
 */

import http from "node:http";

interface Shipment {
  id: string;
  tracking: string;
  status: string;
  events: { status: string; at: string }[];
}

const PORT = Number(process.env.PORT ?? 4010);
const shipments = new Map<string, Shipment>();
const idempotencyMap = new Map<string, string>();

function json(res: http.ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const scenario =
    url.searchParams.get("scenario") ??
    (req.headers["x-scenario"] as string | undefined);

  if (scenario === "timeout") {
    // never respond
    return;
  }
  if (scenario === "error5xx") {
    return json(res, 500, { error: "internal server error" });
  }

  // POST /v1/rates
  if (req.method === "POST" && url.pathname === "/v1/rates") {
    await readBody(req);
    return json(res, 200, {
      quotes: [
        {
          serviceLevel: "standard",
          priceMinor: 5000,
          currency: "EGP",
          etaDays: 2,
        },
      ],
    });
  }

  // POST /v1/shipments
  if (req.method === "POST" && url.pathname === "/v1/shipments") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const idem = body.idempotencyKey as string | undefined;
    if (idem && idempotencyMap.has(idem)) {
      const existingId = idempotencyMap.get(idem)!;
      const existing = shipments.get(existingId)!;
      return json(res, 200, {
        carrierShipmentId: existing.id,
        trackingNumber: existing.tracking,
        status: existing.status,
      });
    }
    const id = `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tracking = `TRK-${id.slice(0, 8)}`;
    const shipment: Shipment = {
      id,
      tracking,
      status: "label_created",
      events: [{ status: "label_created", at: new Date().toISOString() }],
    };
    shipments.set(id, shipment);
    if (idem) idempotencyMap.set(idem, id);
    return json(res, 201, {
      carrierShipmentId: id,
      trackingNumber: tracking,
      status: "label_created",
      labelUrl: `http://localhost:${PORT}/v1/shipments/${id}/label`,
    });
  }

  // GET /v1/shipments/:id
  const getStatusMatch = url.pathname.match(/^\/v1\/shipments\/([^/]+)$/);
  if (req.method === "GET" && getStatusMatch) {
    const id = decodeURIComponent(getStatusMatch[1]);
    const s = shipments.get(id);
    if (!s) return json(res, 404, { error: "not found" });
    return json(res, 200, {
      current: s.status,
      events: s.events,
      trackingNumber: s.tracking,
    });
  }

  // GET /v1/shipments/:id/label
  const getLabelMatch = url.pathname.match(/^\/v1\/shipments\/([^/]+)\/label$/);
  if (req.method === "GET" && getLabelMatch) {
    const id = decodeURIComponent(getLabelMatch[1]);
    if (!shipments.has(id)) return json(res, 404, { error: "not found" });
    res.statusCode = 200;
    res.setHeader("content-type", "application/pdf");
    res.end(Buffer.from("fake-label-pdf"));
    return;
  }

  // POST /v1/shipments/:id/cancel
  const cancelMatch = url.pathname.match(/^\/v1\/shipments\/([^/]+)\/cancel$/);
  if (req.method === "POST" && cancelMatch) {
    const id = decodeURIComponent(cancelMatch[1]);
    const s = shipments.get(id);
    if (!s) return json(res, 404, { error: "not found" });
    s.status = "cancelled";
    s.events.push({ status: "cancelled", at: new Date().toISOString() });
    return json(res, 200, { cancelled: true });
  }

  // POST /v1/webhooks/simulate  -> returns a sample payload the caller can
  // forward to the app's webhook receiver (not used in-process here).
  if (req.method === "POST" && url.pathname === "/v1/webhooks/simulate") {
    const body = JSON.parse((await readBody(req)) || "{}");
    return json(res, 200, {
      eventId: body.eventId ?? `evt-${Date.now()}`,
      shipmentId: body.shipmentId,
      status: body.status ?? "delivered",
    });
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`fake courier listening on http://localhost:${PORT}`);
});
