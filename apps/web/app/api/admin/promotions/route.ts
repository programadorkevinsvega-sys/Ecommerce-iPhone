import { NextResponse } from "next/server";
import { AdminPromotions } from "../../../../../../modules/promotions/application/AdminPromotions";
import { D1PromotionRepository } from "../../../../../../modules/promotions/infrastructure/D1PromotionRepository";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

export async function GET() {
  try {
    const { env } = await requireAdmin(PERMISSIONS.promotionsWrite);
    return NextResponse.json(
      { items: await new AdminPromotions(new D1PromotionRepository(env.DB)).list() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) { return error(e); }
}

export async function POST(request: Request) {
  try {
    const { env, admin, repo } = await requireAdmin(PERMISSIONS.promotionsWrite);
    const body = await request.json() as any;
    const id = await new AdminPromotions(new D1PromotionRepository(env.DB)).save(body, typeof body.id === "string" ? body.id : undefined);
    await repo.audit(admin.id, "ADMIN_PROMOTION_SAVED", "promotion", id, { code: String(body.code ?? "").toUpperCase() });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) { return error(e); }
}

export async function PATCH(request: Request) {
  try {
    const { env, admin, repo } = await requireAdmin(PERMISSIONS.promotionsWrite);
    const body = await request.json() as any;
    const id = String(body.id ?? "");
    const active = body.active === true;
    const ok = await new AdminPromotions(new D1PromotionRepository(env.DB)).setActive(id, active);
    await repo.audit(admin.id, "ADMIN_PROMOTION_ACTIVATED", "promotion", id, { active });
    return NextResponse.json({ updated: ok });
  } catch (e) { return error(e); }
}

function error(e: unknown) {
  const c = e instanceof Error ? e.message : "UNKNOWN";
  const s = c === "UNAUTHORIZED" ? 401 : c === "FORBIDDEN" ? 403 : c === "PROMOTION_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ error: s === 401 ? "Authentication required" : s === 403 ? "Forbidden" : c }, { status: s });
}
