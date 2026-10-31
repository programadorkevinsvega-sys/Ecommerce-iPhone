import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestId } from "./lib/requestCorrelation";
import { buildContentSecurityPolicy } from "./lib/securityHeaders";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isPublicContentRequest(request: NextRequest): boolean {
  return (
    request.method === "GET" &&
    (request.nextUrl.pathname === "/api/content" ||
      request.nextUrl.pathname.startsWith("/api/content/"))
  );
}

function pageResponse(request: NextRequest): Response {
  const nonce = btoa(crypto.randomUUID()).replace(/=+$/g, "");
  const policy = buildContentSecurityPolicy(nonce);
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-nonce", nonce);
  forwardedHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function apiResponse(request: NextRequest): Response {
  const id = resolveRequestId(request.headers);
  const currentOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");
  const isAllowedOrigin = !origin || origin === currentOrigin;

  if (!isAllowedOrigin && (request.method === "OPTIONS" || MUTATING_METHODS.has(request.method))) {
    return NextResponse.json(
      { error: { code: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed." } },
      { status: 403, headers: { "X-Request-Id": id } },
    );
  }

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("X-Request-Id", id);

  const response =
    request.method === "OPTIONS"
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next({ request: { headers: forwardedHeaders } });

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

export function middleware(request: NextRequest): Response {
  return request.nextUrl.pathname.startsWith("/api/")
    ? apiResponse(request)
    : pageResponse(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
