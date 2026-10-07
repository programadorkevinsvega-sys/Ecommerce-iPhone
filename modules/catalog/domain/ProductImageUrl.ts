const TRUSTED_EXTERNAL_IMAGE_HOSTS = new Set([
  "commons.wikimedia.org",
  "upload.wikimedia.org",
  "drive.google.com",
  "lh3.googleusercontent.com",
  "googleusercontent.com",
]);

const PRODUCT_IMAGE_PROXY_PATH = "/api/media/proxy";

export function isTrustedExternalImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      TRUSTED_EXTERNAL_IMAGE_HOSTS.has(url.hostname.toLowerCase()) &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

export function toProductImageProxyUrl(value: string): string {
  if (!isTrustedExternalImageUrl(value)) throw new Error("Untrusted product image source");
  return `${PRODUCT_IMAGE_PROXY_PATH}?url=${encodeURIComponent(new URL(value).toString())}`;
}

export function isProductImageProxyUrl(value: string): boolean {
  try {
    const url = new URL(value, "https://same-origin.invalid");
    if (
      url.origin !== "https://same-origin.invalid" ||
      url.pathname !== PRODUCT_IMAGE_PROXY_PATH ||
      url.hash ||
      url.username ||
      url.password ||
      url.port
    ) return false;

    const targets = url.searchParams.getAll("url");
    if (targets.length !== 1) return false;

    const target = targets[0];
    if (target === undefined) return false;

    return isTrustedExternalImageUrl(target);
  } catch {
    return false;
  }
}

export function normalizeProductImageUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("Invalid product image URL");

  if (normalized.startsWith("/")) {
    const parsed = new URL(normalized, "https://same-origin.invalid");
    const isLegacyImage = parsed.pathname.startsWith("/products/");
    const isManagedImage = /^\/api\/media\/product-images\/[a-z0-9-]+\.(?:jpg|png|webp)$/i.test(parsed.pathname);
    if (
      (isLegacyImage || isManagedImage) &&
      !parsed.search &&
      !parsed.hash &&
      !parsed.pathname.includes("\\")
    ) return parsed.pathname;

    if (isProductImageProxyUrl(normalized)) {
      const target = parsed.searchParams.get("url");
      if (target === null) throw new Error("Invalid product image URL");
      return toProductImageProxyUrl(target);
    }

    throw new Error("Invalid product image URL");
  }

  throw new Error("External product image URLs must be normalized by infrastructure");
}
