import { isTrustedExternalImageUrl, normalizeProductImageUrl, toProductImageProxyUrl } from "../domain/ProductImageUrl";

export function isTrustedProductImageSource(value: string): boolean {
  return isTrustedExternalImageUrl(value);
}

export function normalizeProductImageInput(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (isTrustedExternalImageUrl(normalized)) return toProductImageProxyUrl(normalized);
  try {
    return normalizeProductImageUrl(normalized);
  } catch {
    return undefined;
  }
}
