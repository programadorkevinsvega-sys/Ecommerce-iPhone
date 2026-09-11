function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyMercadoPagoWebhook(secret: string, signatureHeader: string | null, requestId: string | null, dataId: string | null): Promise<void> {
  if (!secret || !signatureHeader || !requestId || !dataId) throw new Error("Mercado Pago webhook signature data is missing");
  const fields = new Map(signatureHeader.split(",").map((part) => part.split("=", 2) as [string, string]));
  const timestamp = fields.get("ts");
  const received = fields.get("v1");
  if (!timestamp || !received) throw new Error("Invalid Mercado Pago webhook signature");
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) throw new Error("Mercado Pago webhook timestamp expired");
  const normalizedId = dataId.toLowerCase();
  const manifest = `id:${normalizedId};request-id:${requestId};ts:${timestamp};`;
  const expected = await hmacSha256(secret, manifest);
  if (!constantTimeEqual(received, expected)) throw new Error("Invalid Mercado Pago webhook signature");
}
