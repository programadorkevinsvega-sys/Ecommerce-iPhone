const ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const HASH_ALGORITHM = "SHA-256";

function encodeBase64(bytes: Uint8Array): string { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function bytesFromBase64(value: string): Uint8Array { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean { if (left.length !== right.length) return false; let difference = 0; for (let index = 0; index < left.length; index += 1) difference |= left[index]! ^ right[index]!; return difference === 0; }

export async function hashCustomerPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) throw new Error("INVALID_PASSWORD");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: HASH_ALGORITHM }, key, KEY_LENGTH);
  return `pbkdf2-sha256$${ITERATIONS}$${encodeBase64(salt)}$${encodeBase64(new Uint8Array(bits))}`;
}

export async function verifyCustomerPassword(password: string, encoded: string | null): Promise<boolean> {
  if (!encoded) { await hashCustomerPassword("customer-unknown-account-password"); return false; }
  const [scheme, iterationText, saltText, hashText] = encoded.split("$");
  const iterations = Number(iterationText);
  if (scheme !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 500_000 || !saltText || !hashText) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: bytesFromBase64(saltText) as unknown as BufferSource, iterations, hash: HASH_ALGORITHM }, key, KEY_LENGTH);
  return timingSafeEqual(new Uint8Array(bits), bytesFromBase64(hashText));
}

export async function hashCustomerToken(token: string): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)); return encodeBase64(new Uint8Array(digest)); }
