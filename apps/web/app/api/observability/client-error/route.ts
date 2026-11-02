import { NextResponse } from "next/server";
import { normalizeOperationalRoute } from "../../../../../lib/operationalTelemetry";
import { logServerError } from "../../../../../server/serverLogger";

const MAX_BODY_BYTES = 1024;
const DIGEST_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid error report" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid error report" }, { status: 400 });
  }

  const value = payload as Record<string, unknown>;
  const digest =
    typeof value.digest === "string" && DIGEST_PATTERN.test(value.digest) ? value.digest : null;
  const routeGroup =
    typeof value.routeGroup === "string"
      ? normalizeOperationalRoute(value.routeGroup)
      : "/other";

  // Do not accept or log browser-provided messages, stacks, URLs, cookies or form data.
  logServerError("client.runtime", new Error("NEXTJS_CLIENT_RUNTIME_ERROR"), {
    component: "nextjs-client",
    errorCode: "NEXTJS_CLIENT_RUNTIME",
    errorDigest: digest,
    routeGroup,
    requestId: request.headers.get("x-request-id")?.trim() || undefined,
    outcome: "reported",
  });

  return NextResponse.json(
    { accepted: true },
    { status: 202, headers: { "cache-control": "no-store" } },
  );
}
