import { isTrustedProductImageSource } from "../../../../../../modules/catalog/application/ProductImagePolicy";

const MAX_REDIRECTS = 3;

function nextLocation(response: Response, current: URL): URL | null {
  const location = response.headers.get("location");
  if (!location) return null;
  try {
    return new URL(location, current);
  } catch {
    return null;
  }
}

async function fetchTrustedImage(initial: URL): Promise<Response | null> {
  let target = initial;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (!isTrustedProductImageSource(target.toString())) return null;

    const response = await fetch(target, { redirect: "manual" });
    if (response.status < 300 || response.status >= 400) return response;

    const location = nextLocation(response, target);
    if (!location) return null;
    target = location;
  }

  return null;
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return new Response("Not found", { status: 404 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (!isTrustedProductImageSource(target.toString())) return new Response("Not found", { status: 404 });

  const response = await fetchTrustedImage(target);
  if (!response?.ok) return new Response("Not found", { status: 404 });

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!contentType?.startsWith("image/")) return new Response("Not found", { status: 404 });

  return new Response(response.body, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": contentType,
    },
  });
}
