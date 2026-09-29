import { NextResponse, type NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function requestId(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();
}

function isPublicContentRequest(request: NextRequest): boolean {
  return (
    request.method === "GET" &&
    (request.nextUrl.pathname === "/api/content" ||
      request.nextUrl.pathname.startsWith("/api/content/"))
  );
}

export function middleware(request: NextRequest): Response {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const currentOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");
  const isAllowedOrigin = !origin || origin === currentOrigin;

  if (!isAllowedOrigin && (request.method === "OPTIONS" || MUTATING_METHODS.has(request.method))) {
    return NextResponse.json(
      { error: { code: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed." },
      },
      { status: 403, headers: { "X-Request-Id": requestId(request) } },
    );
  }

  const response =
    request.method === "OPTIONS"
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next();

  const id = requestId(request);
  response.headers.set("X-Request-Id", id);

  if (!isPublicContentRequest(request)) {
    response.headers.set("Cache-Control", "no-store");
  }

  if (origin === currentOrigin) {
    response.headers.set("Access-Control-Allow-Origin", currentOrigin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  if (request.method === "OPTIONS") {
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Idempotency-Key, X-Request-Id",
    );
    response.headers.set("Access-Control-Max-Age", "600");
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
