import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * cal.com signs the raw request body with HMAC-SHA256 (hex) using the secret
 * set on the webhook subscription, sent in the `x-cal-signature-256` header.
 * https://cal.com/docs/developing/guides/automation/webhooks
 */
export function verifyCalcomSignature(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(signatureHeader, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
