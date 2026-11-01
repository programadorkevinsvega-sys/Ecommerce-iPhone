import { NextResponse } from "next/server";
import { D1WebVitalsRepository } from "../../../../../../../modules/analytics/infrastructure/D1WebVitalsRepository";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { cloudflareEnv } from "../../../../../lib/cloudflareContext";

export async function GET(request: Request) {
  try {
    await requireAdmin("audit:read");
    const days = Number(new URL(request.url).searchParams.get("days") ?? "28");
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      return NextResponse.json({ error: "days must be an integer from 1 to 90" }, { status: 400 });
    }
    const report = await new D1WebVitalsRepository(cloudflareEnv().DB).summary(days);
    return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Authentication required" : status === 403 ? "Insufficient permissions" : "Unable to load Web Vitals report" },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
