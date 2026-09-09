import { NextResponse, type NextRequest } from "next/server";

const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "";

export function middleware(request: NextRequest): Response {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  const response = request.method === "OPTIONS"
    ? new NextResponse(null, { status: 204 })
    : NextResponse.next();

  if (origin && allowedOrigin && origin === allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  if (request.method === "OPTIONS") {
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key, X-Request-Id");
    response.headers.set("Access-Control-Max-Age", "600");
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
