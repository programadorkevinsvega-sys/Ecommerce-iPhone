import { NextResponse } from "next/server";
import type { CmsPageInput } from "../../../../../../modules/cms/application/AdminCms";
import { adminCmsApplication } from "../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

export async function GET() {
  try {
    const { env } = await requireAdmin(PERMISSIONS.cmsWrite);
    return NextResponse.json(
      { items: await adminCmsApplication(env).list() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.cmsWrite);
    const body = (await request.json()) as Record<string, unknown>;
    const id = await adminCmsApplication(env).save(
      parseCmsInput(body),
      typeof body.id === "string" ? body.id : undefined,
      admin.id,
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.cmsWrite);
    const body = (await request.json()) as Record<string, unknown>;
    const updated = await adminCmsApplication(env).setActive(
      String(body.id ?? ""),
      body.active === true,
      admin.id,
    );
    return NextResponse.json({ updated });
  } catch (e) {
    return errorResponse(e);
  }
}
function parseCmsInput(body: Record<string, unknown>): CmsPageInput {
  if (
    typeof body.slug !== "string" ||
    typeof body.title !== "string" ||
    typeof body.content !== "string"
  )
    throw new Error("INVALID_CMS_PAGE");
  if (body.slug === "home-carousel") validateCarouselContent(body.content);
  if (body.seoTitle !== undefined && typeof body.seoTitle !== "string")
    throw new Error("INVALID_CMS_PAGE");
  if (body.seoDescription !== undefined && typeof body.seoDescription !== "string")
    throw new Error("INVALID_CMS_PAGE");
  if (body.canonicalUrl !== undefined && typeof body.canonicalUrl !== "string")
    throw new Error("INVALID_CMS_PAGE");
  if (body.active !== undefined && typeof body.active !== "boolean")
    throw new Error("INVALID_CMS_PAGE");
  return {
    slug: body.slug,
    title: body.title,
    content: body.content,
    ...(body.seoTitle === undefined ? {} : { seoTitle: body.seoTitle }),
    ...(body.seoDescription === undefined ? {} : { seoDescription: body.seoDescription }),
    ...(body.canonicalUrl === undefined ? {} : { canonicalUrl: body.canonicalUrl }),
    ...(body.active === undefined ? {} : { active: body.active }),
  };
}
function validateCarouselContent(content: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("INVALID_CAROUSEL");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { slides?: unknown }).slides) ||
    (parsed as { slides: unknown[] }).slides.length > 20
  )
    throw new Error("INVALID_CAROUSEL");
  for (const item of (parsed as { slides: unknown[] }).slides) {
    if (!item || typeof item !== "object") throw new Error("INVALID_CAROUSEL");
    const slide = item as Record<string, unknown>;
    for (const key of ["id", "eyebrow", "title", "description", "imageUrl", "href"]) {
      if (typeof slide[key] !== "string" || !slide[key].trim()) throw new Error("INVALID_CAROUSEL");
    }
    if (
      String(slide.eyebrow).length > 80 ||
      String(slide.title).length > 180 ||
      String(slide.description).length > 500 ||
      (!/^(?:\/api\/media\/home-carousel\/)[a-z0-9-]+\.(?:jpg|png|webp)$/i.test(
        String(slide.imageUrl),
      ) &&
        !/^https:\/\/(?:drive\.google\.com|lh3\.googleusercontent\.com|[^/]+\.googleusercontent\.com)\//i.test(
          String(slide.imageUrl),
        )) ||
      !/^\/(?!\/)[^\s]*$/.test(String(slide.href)) ||
      String(slide.href).length > 300
    )
      throw new Error("INVALID_CAROUSEL");
  }
}
function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status =
    code === "UNAUTHORIZED"
      ? 401
      : code === "FORBIDDEN"
        ? 403
        : code.includes("NOT_FOUND")
          ? 404
          : 400;
  return NextResponse.json(
    {
      error:
        status === 401
          ? "Authentication required"
          : status === 403
            ? "Forbidden"
            : code === "INVALID_CAROUSEL"
              ? "Los datos de la promoción son inválidos"
              : "No se pudo guardar el contenido",
    },
    { status },
  );
}
