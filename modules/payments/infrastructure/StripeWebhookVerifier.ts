function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return diff === 0;
}

async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyStripeWebhook(rawBody: string, signatureHeader: string | null, secret: string): Promise<Record<string, unknown>> {
  if (!secret || !signatureHeader) throw new Error("Stripe webhook signature is missing");
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) throw new Error("Invalid Stripe webhook signature");
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) throw new Error("Stripe webhook timestamp expired");
  const expected = await hmacSha256(secret, `${timestamp}.${rawBody}`);
  if (!signatures.some((signature) => constantTimeEqual(signature, expected))) throw new Error("Invalid Stripe webhook signature");
  const parsed: unknown = JSON.parse(rawBody);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid Stripe webhook payload");
  return parsed as Record<string, unknown>;
}
