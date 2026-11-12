import crypto from "node:crypto";

export const CARRIER_SIGNATURE_HEADER = "x-carrier-signature";

/** Fails closed: a missing secret or signature never verifies. */
export function verifyCarrierSignature(
  secret: string | undefined,
  rawBody: string | undefined,
  signature: string | undefined,
): boolean {
  if (!secret || rawBody === undefined || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
