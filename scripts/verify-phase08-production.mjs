const BASE_URL = (
  process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com"
).replace(/\/$/, "");

const timeoutMs = Number(process.env.PHASE08_TIMEOUT_MS ?? "15000");

async function request(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      redirect: "manual",
      signal: controller.signal,
      headers: { accept: "application/json,text/html" },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function assertStatus(path, expected) {
  const response = await request(path);
  if (response.status !== expected) {
    throw new Error(
      `${path}: expected HTTP ${expected}, got ${response.status}`,
    );
  }
  console.log(`PASS ${path}: HTTP ${response.status}`);
  return response;
}

async function assertPublicJson(path) {
  const response = await assertStatus(path, 200);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${path}: expected JSON response, got ${contentType}`);
  }

  const cacheControl = response.headers.get("cache-control") ?? "";
  if (!cacheControl.includes("public")) {
    throw new Error(`${path}: expected public cache policy`);
  }

  await response.arrayBuffer();
}

async function assertUnauthorized(path) {
  const response = await assertStatus(path, 401);
  await response.arrayBuffer();
}

for (const path of ["/", "/blog", "/faq", "/catalog", "/contacto"]) {
  await assertStatus(path, 200);
}

for (const kind of [
  "blog",
  "blog-categories",
  "faqs",
  "banners",
  "featured",
  "landing",
]) {
  await assertPublicJson(`/api/content?kind=${kind}`);
}

await assertStatus("/api/content?kind=invalid", 400);
await assertStatus("/api/content/blog/not-a-real-production-slug-08-4", 404);
await assertStatus("/landing/not-a-real-production-slug-08-4", 404);
await assertStatus("/content/not-a-real-production-slug-08-4", 404);

for (const path of [
  "/api/admin/content",
  "/api/admin/campaigns",
  "/api/admin/coupons",
  "/api/admin/reviews",
  "/api/admin/reviews/reports",
]) {
  await assertUnauthorized(path);
}

console.log(`Phase 08.4 production smoke passed for ${BASE_URL}`);
