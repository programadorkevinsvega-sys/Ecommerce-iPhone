import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

const TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  try {
    await requireAdmin(PERMISSIONS.cmsWrite);
    const { env } = getCloudflareContext();
    const scope = new URL(request.url).searchParams.get("scope");
    const prefix = scope === "product" ? "product-images" : scope === "home" ? "home-carousel" : "";
    if (!prefix) return NextResponse.json({ error: "Invalid media scope" }, { status: 400 });
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !TYPES.has(file.type) ||
      file.size < 1 ||
      file.size > 5 * 1024 * 1024
    ) {
      return NextResponse.json({ error: "Archivo de imagen inválido" }, { status: 400 });
    }
    const key = `${prefix}/${crypto.randomUUID()}.${TYPES.get(file.type)}`;
    await env.MEDIA_BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    return NextResponse.json(
      { url: `/api/media/${key}` },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Authentication required"
            : status === 403
              ? "Forbidden"
              : "No se pudo cargar la imagen",
      },
      { status },
    );
  }
}
