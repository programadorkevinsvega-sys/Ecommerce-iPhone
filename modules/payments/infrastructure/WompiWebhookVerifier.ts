type WompiWebhook = Readonly<{
  event?: unknown;
  data?: unknown;
  signature?: { properties?: unknown; checksum?: unknown };
  timestamp?: unknown;
  environment?: unknown;
}>;

function getPath(root: unknown, path: string): string {
  let current = root;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) throw new Error(`Missing signed property: ${path}`);
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== "string" && typeof current !== "number" && typeof current !== "boolean") throw new Error(`Invalid signed property: ${path}`);
  return String(current);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyWompiWebhook(payload: string, eventSecret: string, headerChecksum: string | null): Promise<WompiWebhook> {
  if (!eventSecret) throw new Error("Wompi events secret is not configured");
  const event = JSON.parse(payload) as WompiWebhook;
  if (event.environment !== "prod") throw new Error("Only Wompi production webhooks are accepted");
  if (event.event !== "transaction.updated") throw new Error("Unsupported Wompi event");
  const properties = event.signature?.properties;
  const checksum = typeof event.signature?.checksum === "string" ? event.signature.checksum : "";
  if (!Array.isArray(properties) || !properties.every((value): value is string => typeof value === "string")) throw new Error("Invalid Wompi signature properties");
  if (!event.timestamp || !event.data) throw new Error("Incomplete Wompi webhook");

  const signedValues = properties.map((property) => getPath(event.data, property)).join("");
  const expected = await sha256Hex(`${signedValues}${event.timestamp}${eventSecret}`);
  const supplied = headerChecksum || checksum;
  if (!supplied || !constantTimeEqual(expected.toLowerCase(), supplied.toLowerCase())) throw new Error("Invalid Wompi webhook signature");
  return event;
}
