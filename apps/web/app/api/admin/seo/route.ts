import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin, PERMISSIONS } from "../../../../lib/adminAuth";
import { seoManagementApplication } from "../../../../lib/seoApplication";

export async function GET() {
  try {
    const { env } = await requireAdmin(PERMISSIONS.seoWrite);
    const management = seoManagementApplication(env);
    const [redirects, routes] = await Promise.all([
      management.redirects(),
      management.routeOverrides(),
    ]);
    return NextResponse.json({ redirects, routes }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.seoWrite);
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("INVALID_SEO");
    const value = body as Record<string, unknown>;
    const kind = value.kind;
    if (kind === "redirect") {
      if (typeof value.sourcePath !== "string" || typeof value.statusCode !== "number" || typeof value.active !== "boolean") {
        throw new Error("INVALID_SEO_REDIRECT");
      }
      const targetUrl = typeof value.targetUrl === "string" ? value.targetUrl : undefined;
      await seoManagementApplication(env).saveRedirect({
        id: typeof value.id === "string" && value.id ? value.id : crypto.randomUUID(),
        sourcePath: value.sourcePath,
        ...(targetUrl ? { targetUrl } : {}),
        statusCode: value.statusCode as 301 | 410,
        active: value.active,
        adminId: admin.id,
      });
      return NextResponse.json({ saved: true });
    }

    if (kind === "route") {
      if (typeof value.path !== "string" || typeof value.indexable !== "boolean") {
        throw new Error("INVALID_SEO_ROUTE");
      }
      const optional = (key: string) =>
        typeof value[key] === "string" && value[key] !== "" ? (value[key] as string) : undefined;
      await seoManagementApplication(env).saveRouteOverride({
        id: typeof value.id === "string" && value.id ? value.id : crypto.randomUUID(),
        path: value.path,
        indexable: value.indexable,
        ...(optional("seoTitle") ? { seoTitle: optional("seoTitle") } : {}),
        ...(optional("seoDescription") ? { seoDescription: optional("seoDescription") } : {}),
        ...(optional("canonicalUrl") ? { canonicalUrl: optional("canonicalUrl") } : {}),
        ...(optional("ogImageUrl") ? { ogImageUrl: optional("ogImageUrl") } : {}),
        adminId: admin.id,
      });
      revalidateTag("seo-route-override");
      return NextResponse.json({ saved: true });
    }

    throw new Error("INVALID_SEO_KIND");
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status =
    code === "UNAUTHORIZED" ? 401 :
    code === "FORBIDDEN" ? 403 :
    code.startsWith("INVALID_") || code.startsWith("SEO_") ? 400 : 400;
  return NextResponse.json(
    { error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : code },
    { status },
  );
}
