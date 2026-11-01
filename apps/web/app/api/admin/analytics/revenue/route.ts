import { NextResponse } from "next/server";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";
import { revenueAnalyticsApp } from "../../../../../lib/analyticsApplication";
import { logServerError } from "../../../../../server/serverLogger";

function defaultFrom(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET(request: Request) {
  try {
    const { env } = await requireAdmin(PERMISSIONS.dashboardRead);
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? defaultFrom();
    const to = url.searchParams.get("to") ?? new Date().toISOString();
    const report = await revenueAnalyticsApp(env).report(from, to);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "FORBIDDEN" || message === "ADMIN_STEP_UP_REQUIRED") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (message === "INVALID_REVENUE_PERIOD" || message === "REVENUE_PERIOD_TOO_LARGE") {
      return NextResponse.json(
        { error: message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    logServerError("admin.analytics.revenue", error, {
      component: "analytics",
      requestId: request.headers.get("x-request-id")?.trim() || undefined,
      operation: "revenue-report",
      outcome: "failed",
    });
    return NextResponse.json(
      { error: "Revenue report unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
