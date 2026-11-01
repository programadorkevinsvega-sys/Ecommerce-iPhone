type LogContext = Readonly<Record<string, string | number | boolean | null | undefined>>;

const SENSITIVE_CONTEXT_KEY =
  /authorization|cookie|password|passphrase|token|secret|api.?key|signature|session|email|phone|address|card|cvv|cvc|ip(?:address)?|fingerprint|customer.?name|first.?name|last.?name|account.?id|user.?id|admin.?id|customer.?id|device.?id|imei|serial.?number/i;

const RESERVED_CONTEXT_KEYS = new Set(["timestamp", "level", "source", "operation", "error"]);

function sanitizeText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|authorization)\s*[:=]\s*["']?[^,\s"']+/gi,
      "$1=[REDACTED]",
    )
    .replace(/([?&](?:token|key|secret|signature)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/https?:\/\/[^/\s:@]+:[^@\s]+@/gi, "https://[REDACTED]@")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[REDACTED_CARD]")
    .replace(/\+\d{8,15}\b/g, "[REDACTED_PHONE]")
    .replace(
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
      "[REDACTED_PRIVATE_KEY]",
    )
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 1000);
}

function sanitizeContext(
  context: LogContext,
): Record<string, string | number | boolean | null | undefined> {
  const safe: Record<string, string | number | boolean | null | undefined> = {};
  for (const [key, value] of Object.entries(context)) {
    if (RESERVED_CONTEXT_KEYS.has(key)) continue;
    safe[key] = SENSITIVE_CONTEXT_KEY.test(key)
      ? "[REDACTED]"
      : typeof value === "string"
        ? sanitizeText(value)
        : value;
  }
  return safe;
}

function serializeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      name: sanitizeText(error.name).slice(0, 80),
      message: sanitizeText(error.message),
    };
  }
  return { message: sanitizeText(String(error)) };
}

export function logServerError(operation: string, error: unknown, context: LogContext = {}): void {
  globalThis["console"]["error"](
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      source: "server",
      operation: sanitizeText(operation).slice(0, 120),
      ...sanitizeContext(context),
      error: serializeError(error),
    }),
  );
}
