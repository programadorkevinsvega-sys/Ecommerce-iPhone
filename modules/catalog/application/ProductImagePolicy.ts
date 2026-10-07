import { isTrustedExternalImageUrl } from "../domain/ProductImageUrl";

export function isTrustedProductImageSource(value: string): boolean {
  return isTrustedExternalImageUrl(value);
}
