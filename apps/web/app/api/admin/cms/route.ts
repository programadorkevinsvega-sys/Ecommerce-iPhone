import { NextResponse } from "next/server";
import { AdminCms } from "../../../../../../modules/cms/application/AdminCms";
import { D1CmsRepository } from "../../../../../../modules/cms/infrastructure/D1CmsRepository";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

export async function GET() {
  try {
    const { env } = await requireAdmin(PERMISSIONS.cmsWrite);
    return NextResponse.json(
      { items: await new AdminCms(new D1CmsRepository(env.DB)).list() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { env, admin, repo } = await requireAdmin(PERMISSIONS.cmsWrite);
    const body = (await request.json()) as Record<string, unknown>;
    const id = await new AdminCms(new D1CmsRepository(env.DB)).save(
      body,
      typeof body.id === "string" ? body.id : undefined,
      admin.id,
    );
    await repo.audit(admin.id, "ADMIN_CMS_PAGE_SAVED", "cms_page", id, { slug: body.slug });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { env, admin, repo } = await requireAdmin(PERMISSIONS.cmsWrite);
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    const active = body.active === true;
    const updated = await new AdminCms(new D1CmsRepository(env.DB)).setActive(id, active, admin.id);
    await repo.audit(admin.id, "ADMIN_CMS_PAGE_ACTIVATED", "cms_page", id, { active });
    return NextResponse.json({ updated });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code.includes("NOT_FOUND") ? 404 : 400;
  return NextResponse.json({ error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : code }, { status });
}
