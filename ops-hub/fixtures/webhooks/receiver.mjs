/**
 * Sample receiver for Ops Hub outbound webhooks.
 *
 * Verifies the HMAC-SHA256 signature in `x-ops-hub-signature` against the
 * shared secret, exactly as a real consumer would.
 *
 * Run:  node fixtures/webhooks/receiver.mjs [port] [secret]
 */

import crypto from "node:crypto";
import http from "node:http";

const port = Number(process.argv[2] ?? 4020);
const secret = process.argv[3] ?? "test-secret";

function verify(rawBody, signature) {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

http
  .createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const signature = req.headers["x-ops-hub-signature"];
      if (!verify(raw, signature)) {
        console.log("invalid signature -> 401");
        res.statusCode = 401;
        res.end(JSON.stringify({ error: "invalid signature" }));
        return;
      }
      console.log("verified delivery:", raw);
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true }));
    });
  })
  .listen(port, () => {
    console.log(`webhook receiver listening on http://localhost:${port}`);
  });
