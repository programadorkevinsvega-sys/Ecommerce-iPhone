import { NextResponse } from "next/server";
import { D1WebVitalsRepository } from "../../../../../../modules/analytics/infrastructure/D1WebVitalsRepository";
import { parseWebVitalInput, rateWebVital } from "../../../../../../modules/analytics/application/WebVitals";
import { cloudflareEnv } from "../../../../lib/cloudflareContext";

const MAX_BODY_BYTES = 1024;

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function runtimeEnvironment(request: Request, configured: string): string {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")) return "local";
  if (hostname.endsWith(".workers.dev")) return "preview";
  return ["production", "preview", "development", "local"].includes(configured) ? configured : "unknown";
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
    }
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const env = cloudflareEnv();
    const address = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const limit = await env.SENSITIVE_RATE_LIMITER.limit({
      key: `web-vitals:${await hash(address)}`,
    });
    if (!limit.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const measurement = parseWebVitalInput(JSON.parse(raw) as unknown);
    await new D1WebVitalsRepository(env.DB).record({
      ...measurement,
      rating: rateWebVital(measurement.metric, measurement.value),
      environment: runtimeEnvironment(request, env.APP_ENV),
      release: typeof env.RELEASE_ID === "string" ? env.RELEASE_ID.slice(0, 64) : null,
      measuredAt: new Date().toISOString(),
    });
    return NextResponse.json({ accepted: true }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const invalidPayload = code.startsWith("INVALID_WEB_VITAL") || error instanceof SyntaxError;
    return NextResponse.json(
      { error: invalidPayload ? "Invalid Web Vitals measurement" : "Unable to store Web Vitals measurement" },
      { status: invalidPayload ? 400 : 500, headers: { "cache-control": "no-store" } },
    );
  }
}
