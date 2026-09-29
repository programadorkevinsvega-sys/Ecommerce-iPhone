const BASE_URL = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");

async function request(path) {
  const response = await fetch(BASE_URL + path, {
    redirect: "manual",
    headers: { accept: "text/html,application/xml,text/plain" },
  });
  const body = await response.text();
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertStatus(path, expected) {
  const { response, body } = await request(path);
  assert(response.status === expected, path + ": expected HTTP " + expected + ", got " + response.status);
  console.log("PASS " + path + ": HTTP " + response.status);
  return { response, body };
}

const robots = await assertStatus("/robots.txt", 200);
assert(robots.body.includes("Sitemap: " + BASE_URL + "/sitemap.xml"), "robots.txt does not reference production sitemap");
assert(!robots.body.includes("example.com"), "robots.txt contains example.com");
assert(/Disallow:\s*\/admin/i.test(robots.body), "robots.txt does not disallow admin");
assert(/Disallow:\s*\/api/i.test(robots.body), "robots.txt does not disallow API");

const sitemap = await assertStatus("/sitemap.xml", 200);
const sitemapType = sitemap.response.headers.get("content-type") ?? "";
assert(sitemapType.includes("xml"), "sitemap.xml is not XML");
assert(sitemap.body.includes(BASE_URL + "/"), "sitemap does not contain production origin");
assert(!sitemap.body.includes("example.com"), "sitemap contains example.com");
assert(!/\/admin(?:[<\/?]|$)/i.test(sitemap.body), "sitemap contains admin URL");
assert(!/\/api(?:[<\/?]|$)/i.test(sitemap.body), "sitemap contains API URL");

const escapedOrigin = BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const productMatch = sitemap.body.match(new RegExp("<loc>" + escapedOrigin + "(/iphone/[^<]+)</loc>"));
if (productMatch) {
  const product = await assertStatus(productMatch[1], 200);
  const jsonLdBlocks = [...product.body.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1]?.trim())
    .filter((value) => Boolean(value));
  assert(jsonLdBlocks.length > 0, "product page has no JSON-LD");
  const schemas = jsonLdBlocks.flatMap((value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  });
  assert(
    schemas.some((schema) => schema && typeof schema === "object" && schema["@type"] === "Product"),
    "product page has no Product structured data",
  );
  assert(
    schemas.some((schema) => schema && typeof schema === "object" && schema["@type"] === "BreadcrumbList"),
    "product page has no BreadcrumbList structured data",
  );
  assert(product.body.includes("rel=\"canonical\""), "product page has no canonical");
  console.log("PASS product SEO smoke");
}

const blogMatch = sitemap.body.match(new RegExp("<loc>" + escapedOrigin + "(/blog/[^<]+)</loc>"));
if (blogMatch) {
  const blog = await assertStatus(blogMatch[1], 200);
  assert(blog.body.includes("\"@type\":\"Article\""), "blog page has no Article structured data");
  assert(blog.body.includes("\"@type\":\"BreadcrumbList\""), "blog page has no BreadcrumbList structured data");
  console.log("PASS blog SEO smoke");
}

const faq = await assertStatus("/faq", 200);
if (faq.body.includes("<details>")) {
  assert(faq.body.includes("\"@type\":\"FAQPage\""), "FAQ page has published FAQs but no FAQPage schema");
}
assert(faq.body.includes("\"@type\":\"BreadcrumbList\""), "FAQ page has no BreadcrumbList structured data");

const filtered = await assertStatus("/catalog?q=seo-verification-nonexistent", 200);
assert(filtered.body.includes("name=\"robots\"") && /noindex/i.test(filtered.body), "filtered catalog is not marked noindex");

const missing = await assertStatus("/iphone/seo-verification-not-found", 404);
assert(/noindex/i.test(missing.body), "404 product response is not noindex");

console.log("Phase 09 production SEO smoke passed for " + BASE_URL);