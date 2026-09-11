import { NextResponse } from "next/server";
import { AdminInventory } from "../../../../../modules/inventory/application/AdminInventory";
import { D1InventoryRepository } from "../../../../../modules/inventory/infrastructure/D1InventoryRepository";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

function bodyRecord(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY"); return value as Record<string, unknown>; }

export async function GET(request: Request) {
  try {
    const { env } = await requireAdmin(PERMISSIONS.inventoryWrite);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    if (!Number.isInteger(limit) || !Number.isInteger(offset) || limit < 1 || limit > 100 || offset < 0) return NextResponse.json({ error: "Invalid pagination" }, { status: 400 });
    const items = await new AdminInventory(new D1InventoryRepository(env.DB)).list(url.searchParams.get("productId") ?? undefined, limit, offset);
    return NextResponse.json({ items, limit, offset }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { env, admin, repo } = await requireAdmin(PERMISSIONS.inventoryWrite);
    const body = bodyRecord(await request.json());
    const productId = String(body.productId ?? "");
    const delta = typeof body.delta === "number" ? body.delta : Number(body.delta);
    const reason = String(body.reason ?? "");
    const key = request.headers.get("Idempotency-Key") ?? String(body.idempotencyKey ?? "");
    const result = await new AdminInventory(new D1InventoryRepository(env.DB)).adjust(productId, delta, reason, key, admin.id);
    await repo.audit(admin.id, "ADMIN_INVENTORY_ADJUSTED", "product", productId, { delta, reason });
    return NextResponse.json({ adjustment: result }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "PRODUCT_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : code }, { status });
}
