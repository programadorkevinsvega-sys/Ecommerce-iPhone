function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

async function hmacSha512(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function verifyBinancePayWebhook(secret: string, body: string, timestamp: string | null, nonce: string | null, certificateSn: string | null, signature: string | null): Promise<void> {
  if (!secret || !timestamp || !nonce || !certificateSn || !signature) throw new Error("Binance Pay webhook signature data is missing");
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(Date.now() - timestampNumber) > 300000) throw new Error("Binance Pay webhook timestamp expired");
  const expected = await hmacSha512(secret, `${timestamp}\n${nonce}\n${body}\n`);
  if (!constantTimeEqual(signature.toUpperCase(), expected)) throw new Error("Invalid Binance Pay webhook signature");
}
