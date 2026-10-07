import { NextResponse } from "next/server";
import { cloudflareEnv } from "../../../../lib/cloudflareContext";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

const TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  try {
    await requireAdmin(PERMISSIONS.cmsWrite);
    const env = cloudflareEnv();
    const scope = new URL(request.url).searchParams.get("scope");
    const prefix = scope === "product" ? "product-images" : scope === "home" ? "home-carousel" : scope === "category" ? "category-images" : scope === "service" ? "service-images" : "";
    if (!prefix) return NextResponse.json({ error: "Invalid media scope" }, { status: 400 });
    const form = await request.formData();
    const files = form.getAll("file");
    if (
      files.length < 1 ||
      files.length > 5 ||
      files.some(
        (file) =>
          !(file instanceof File) ||
          !TYPES.has(file.type) ||
          file.size < 1 ||
          file.size > 5 * 1024 * 1024,
      )
    ) {
      return NextResponse.json({ error: "Archivos de imagen inválidos" }, { status: 400 });
    }
    const urls: string[] = [];
    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Archivo de imagen inválido" }, { status: 400 });
      }
      const key = `${prefix}/${crypto.randomUUID()}.${TYPES.get(file.type)}`;
      await env.MEDIA_BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      urls.push(`/api/media/${key}`);
    }
    return NextResponse.json(
      { urls },
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
