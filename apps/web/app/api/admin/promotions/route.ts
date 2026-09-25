import { NextResponse } from "next/server";
import type { PromotionInput } from "@modules/promotions/application/AdminPromotions";

function parseBody(value: unknown): { input: PromotionInput; id?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_PROMOTION");
  const b = value as Record<string, unknown>;
  const strings = (v: unknown): string[] => Array.isArray(v) && v.every(x => typeof x === "string") ? v : [];
  if (typeof b.code !== "string" || typeof b.name !== "string" || (b.discountType !== "PERCENT" && b.discountType !== "FIXED") || !Number.isSafeInteger(b.discountValue) || !Number.isSafeInteger(b.minSubtotalInCents) || !Number.isSafeInteger(b.maxUses) && b.maxUses !== null && b.maxUses !== undefined || typeof b.startsAt !== "string" || typeof b.endsAt !== "string" || typeof b.active !== "boolean") throw new Error("INVALID_PROMOTION");
  const input: PromotionInput = { code:b.code,name:b.name,discountType:b.discountType,discountValue:b.discountValue,minSubtotalInCents:b.minSubtotalInCents,maxUses:b.maxUses === undefined ? null : b.maxUses as number|null,startsAt:b.startsAt,endsAt:b.endsAt,active:b.active,productIds:strings(b.productIds),categoryIds:strings(b.categoryIds),id:typeof b.id === "string" ? b.id : undefined };
  return { input, ...(input.id ? {id:input.id} : {}) };
}
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
    const parsed = parseBody(await request.json());
    const id = await adminPromotionsApplication(env).save(parsed.input, admin.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) { return error(e); }
}

export async function PATCH(request: Request) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.promotionsWrite);
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("INVALID_PROMOTION");
    const record = body as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const active = record.active === true;
    const ok = await adminPromotionsApplication(env).setActive(id, active, admin.id);
    return NextResponse.json({ updated: ok });
  } catch (e) { return error(e); }
}

function error(e: unknown) {
  const c = e instanceof Error ? e.message : "UNKNOWN";
  const s = c === "UNAUTHORIZED" ? 401 : c === "FORBIDDEN" ? 403 : c === "PROMOTION_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ error: s === 401 ? "Authentication required" : s === 403 ? "Forbidden" : c }, { status: s });
}
