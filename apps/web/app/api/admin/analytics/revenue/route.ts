import { NextResponse } from "next/server";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";
import { revenueAnalyticsApp } from "../../../../../lib/analyticsApplication";

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
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message === "INVALID_REVENUE_PERIOD" || message === "REVENUE_PERIOD_TOO_LARGE") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
