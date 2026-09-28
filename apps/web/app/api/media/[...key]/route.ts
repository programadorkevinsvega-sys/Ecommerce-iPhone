import { cloudflareEnv } from "../../../../lib/cloudflareContext";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const env = cloudflareEnv();
  const key = (await params).key.join("/");
  if (!key || key.includes("..")) return new Response("Not found", { status: 404 });
  const object = await env.MEDIA_BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body as unknown as BodyInit, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      etag: object.httpEtag,
    },
  });
}
