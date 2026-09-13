export const INPUT_LIMITS = {
  email: { min: 3, max: 254 },
  name: { min: 1, max: 80 },
  phone: { min: 7, max: 25 },
  addressLine: { min: 1, max: 180 },
  city: { min: 1, max: 80 },
  state: { min: 1, max: 80 },
  postalCode: { min: 3, max: 20 },
  orderId: { min: 1, max: 128 },
  search: { min: 1, max: 100 },
  reviewBody: { min: 10, max: 3000 },
  reviewTitle: { min: 1, max: 160 },
  serviceType: { min: 1, max: 64 },
  deviceBrand: { min: 1, max: 80 },
  deviceModel: { min: 1, max: 120 },
  carrier: { min: 1, max: 100 },
  imei: { min: 4, max: 20 },
  serial: { min: 4, max: 30 },
  serviceDescription: { min: 1, max: 3000 },
  serviceNotes: { min: 0, max: 2000 },
  promotionCode: { min: 3, max: 64 },
} as const;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/gu;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PHONE_PATTERN = /^[+()\d][\d\s().-]{6,24}$/u;

export function normalizeUnicode(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFC") : "";
}

export function normalizeSingleLine(value: unknown): string {
  return normalizeUnicode(value).replace(CONTROL_CHARS, "").replace(/\s+/gu, " ").trim();
}

export function normalizeMultiline(value: unknown): string {
  return normalizeUnicode(value)
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t ]+/gu, " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function normalizeEmail(value: unknown): string {
  return normalizeSingleLine(value).toLowerCase();
}

export function normalizePhone(value: unknown): string {
  return normalizeSingleLine(value).replace(/\s+/gu, " ");
}

export function normalizeSearchQuery(value: unknown): string | undefined {
  const normalized = normalizeSingleLine(value).slice(0, INPUT_LIMITS.search.max);
  return normalized || undefined;
}

export function normalizeIdentifier(value: unknown, maxLength = INPUT_LIMITS.orderId.max): string {
  return normalizeSingleLine(value).slice(0, maxLength);
}

export function assertLength(value: string, field: keyof typeof INPUT_LIMITS): string {
  const limits = INPUT_LIMITS[field];
  if (value.length < limits.min || value.length > limits.max) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function validateEmail(value: string): string {
  const normalized = assertLength(normalizeEmail(value), "email");
  if (!EMAIL_PATTERN.test(normalized)) throw new Error("INVALID_EMAIL");
  return normalized;
}

export function validatePhone(value: string): string {
  const normalized = assertLength(normalizePhone(value), "phone");
  if (!PHONE_PATTERN.test(normalized)) throw new Error("INVALID_PHONE");
  return normalized;
}

export function validateSearchQuery(value: unknown): string | undefined {
  return normalizeSearchQuery(value);
}

export function validateRating(value: unknown): number {
  const rating = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("INVALID_RATING");
  return rating;
}

export function safeFormError(status: number | undefined, fallback: string): string {
  if (status === 401) return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
  if (status === 403) return "No tienes autorización para realizar esta operación.";
  if (status === 409) return "La operación ya fue registrada o entra en conflicto con el estado actual.";
  if (status !== undefined && status >= 400 && status < 500) return "Revisa los datos ingresados e inténtalo nuevamente.";
  return fallback;
}
