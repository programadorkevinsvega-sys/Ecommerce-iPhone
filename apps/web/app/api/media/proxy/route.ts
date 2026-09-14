const ALLOWED_HOSTS = ["drive.google.com", "lh3.googleusercontent.com", "googleusercontent.com"];

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return new Response("Not found", { status: 404 });
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (
    target.protocol !== "https:" ||
    !ALLOWED_HOSTS.some((host) => target.hostname === host || target.hostname.endsWith(`.${host}`))
  )
    return new Response("Not found", { status: 404 });
  const response = await fetch(target, { redirect: "follow" });
  if (!response.ok) return new Response("Not found", { status: 404 });
  return new Response(response.body, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": response.headers.get("content-type") ?? "image/jpeg",
    },
  });
}
