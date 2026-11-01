export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function isValidRequestId(value: string | null | undefined): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value.trim());
}

export function resolveRequestId(headers: Headers): string {
  const supplied = headers.get(REQUEST_ID_HEADER)?.trim();
  return supplied && isValidRequestId(supplied) ? supplied : crypto.randomUUID();
}
