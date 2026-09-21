const ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const HASH_ALGORITHM = "SHA-256";

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const bytesFromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index]! ^ b[index]!;
  }
  return diff === 0;
}

export async function hashTechnicianPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) {
    throw new Error("Password must contain 12-128 characters");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: HASH_ALGORITHM },
    key,
    KEY_LENGTH,
  );

  return `pbkdf2-sha256$${ITERATIONS}$${encodeBase64(salt)}$${encodeBase64(new Uint8Array(bits))}`;
}

export async function verifyTechnicianPassword(password: string, encoded: string) {
  const [scheme, iterationText, saltText, hashText] = encoded.split("$");
  if (!scheme || !iterationText || !saltText || !hashText || scheme !== "pbkdf2-sha256") {
    return false;
  }

  const iterations = Number(iterationText);
  if (!Number.isInteger(iterations) || iterations < ITERATIONS || iterations > 500_000) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: bytesFromBase64(saltText),
      iterations,
      hash: HASH_ALGORITHM,
    },
    key,
    KEY_LENGTH,
  );

  return timingSafeEqual(new Uint8Array(bits), bytesFromBase64(hashText));
}

export async function sha256Technician(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return encodeBase64(new Uint8Array(digest));
}

export const TECHNICIAN_UNKNOWN_ACCOUNT_DUMMY_HASH =
  "pbkdf2-sha256$100000$YWRtaW4tYXV0aC1kdW1teS12MQ==$tGNg2tVRJmixbNAmRjz8qyH8LrlC7YDPLs/SFN1eU6g=";
