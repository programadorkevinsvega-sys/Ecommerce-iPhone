import { NextResponse } from "next/server";
import { adminPromotionsApplication } from "../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

export async function GET() {
  try {
    const { env } = await requireAdmin(PERMISSIONS.promotionsWrite);
    return NextResponse.json(
      { items: await adminPromotionsApplication(env).list() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) { return error(e); }
}

export async function POST(request: Request) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.promotionsWrite);
    const body = await request.json() as any;
    const id = await adminPromotionsApplication(env).save(body, typeof body.id === "string" ? body.id : undefined, admin.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) { return error(e); }
}

export async function PATCH(request: Request) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.promotionsWrite);
    const body = await request.json() as any;
    const id = String(body.id ?? "");
    const active = body.active === true;
    const ok = await adminPromotionsApplication(env).setActive(id, active, admin.id);
    return NextResponse.json({ updated: ok });
  } catch (e) { return error(e); }
}

function error(e: unknown) {
  const c = e instanceof Error ? e.message : "UNKNOWN";
  const s = c === "UNAUTHORIZED" ? 401 : c === "FORBIDDEN" ? 403 : c === "PROMOTION_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ error: s === 401 ? "Authentication required" : s === 403 ? "Forbidden" : c }, { status: s });
}
