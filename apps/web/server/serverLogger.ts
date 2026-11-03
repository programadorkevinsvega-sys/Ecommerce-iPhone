type LogValue = string | number | boolean | null | undefined;
type LogContext = Readonly<Record<string, LogValue>>;
export type ServerLogLevel = "debug" | "info" | "warn" | "error";

const SERVICE_NAME = "ecommerce-iphone-web";
const TRACE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const ERROR_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_.:-]{0,79}$/;
const ENVIRONMENT_PATTERN = /^(development|test|preview|staging|production)$/;

const SENSITIVE_CONTEXT_KEY =
  /authorization|cookie|password|passphrase|token|secret|api.?key|signature|session|email|phone|address|recipient.?name|(?:^|[_-])name(?:$|[_-])|card|cvv|cvc|ip(?:address)?|fingerprint|customer.?name|first.?name|last.?name|account.?id|user.?id|admin.?id|customer.?id|device.?id|imei|serial|billing|recipient/i;

const RESERVED_CONTEXT_KEYS = new Set([
  "timestamp",
  "level",
  "service",
  "environment",
  "source",
  "operation",
  "error",
  "requestId",
  "correlationId",
  "route",
  "durationMs",
  "status",
  "errorCode",
  "debugEnabled",
]);

function sanitizeText(value: string): string {
  return value
    .replace(
      /(\bimei(?:[\s_-]?(?:number|no|#))?\s*[:=#-]\s*)[A-Z0-9 -]{14,20}/gi,
      "$1[REDACTED_IMEI]",
    )
    .replace(
      /(\bserial(?:[\s_-]?(?:number|no|#))?\s*[:=#-]\s*)[A-Z0-9-]{6,32}/gi,
      "$1[REDACTED_SERIAL]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|authorization)\s*[:=]\s*["']?[^,\s"']+/gi,
      "$1=[REDACTED]",
    )
    .replace(/([?&](?:token|key|secret|signature)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/https?:\/\/[^/\s:@]+:[^@\s]+@/gi, "https://[REDACTED]@")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[REDACTED_CARD_OR_DEVICE_ID]")
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
): Record<string, LogValue> {
  const safe: Record<string, LogValue> = {};
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

function runtimeEnvironment(): string {
  if (typeof process === "undefined") return "unknown";
  const configured = process.env.APP_ENV;
  return typeof configured === "string" && ENVIRONMENT_PATTERN.test(configured)
    ? configured
    : "unknown";
}

function resolveEnvironment(value: LogValue): string {
  const candidate = typeof value === "string" ? value : runtimeEnvironment();
  return ENVIRONMENT_PATTERN.test(candidate) ? candidate : "unknown";
}

function safeTraceId(value: LogValue): string | undefined {
  return typeof value === "string" && TRACE_ID_PATTERN.test(value) ? value : undefined;
}

function safeErrorCode(value: unknown): string | undefined {
  return typeof value === "string" && ERROR_CODE_PATTERN.test(value) ? value : undefined;
}

function errorCodeFrom(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return safeErrorCode((error as { code?: unknown }).code);
}

function safeDuration(value: LogValue): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value * 100) / 100
    : undefined;
}

function safeStatus(value: LogValue): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

function safeRoute(value: LogValue): string | undefined {
  if (typeof value !== "string") return undefined;
  const route = sanitizeText(value).split("?")[0]?.slice(0, 160);
  return route || undefined;
}

function debugEnabled(context: LogContext): boolean {
  if (context.debugEnabled === true) return true;
  if (typeof process === "undefined") return false;
  return process.env.APP_LOG_LEVEL === "debug";
}

function writeRecord(
  level: ServerLogLevel,
  source: string,
  operation: string,
  context: LogContext,
  error?: unknown,
): void {
  const record = {
    ...sanitizeContext(context),
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    environment: resolveEnvironment(context.environment),
    source,
    operation: sanitizeText(operation).slice(0, 120),
    ...(safeTraceId(context.requestId) ? { requestId: safeTraceId(context.requestId) } : {}),
    ...(safeTraceId(context.correlationId)
      ? { correlationId: safeTraceId(context.correlationId) }
      : {}),
    ...(safeRoute(context.route) ? { route: safeRoute(context.route) } : {}),
    ...(safeDuration(context.durationMs) !== undefined
      ? { durationMs: safeDuration(context.durationMs) }
      : {}),
    ...(safeStatus(context.status) !== undefined ? { status: safeStatus(context.status) } : {}),
    ...(safeErrorCode(context.errorCode) ?? errorCodeFrom(error)
      ? { errorCode: safeErrorCode(context.errorCode) ?? errorCodeFrom(error) }
      : {}),
    ...(error === undefined ? {} : { error: serializeError(error) }),
  };
  const serialized = JSON.stringify(record);
  const output = globalThis["console"];
  if (level === "error") output.error(serialized);
  else if (level === "warn") output.warn(serialized);
  else if (level === "debug") output.debug(serialized);
  else output.log(serialized);
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

export function logServerDebug(operation: string, context: LogContext = {}): void {
  if (!debugEnabled(context)) return;
  writeRecord("debug", "server", operation, context);
}

export function logServerInfo(operation: string, context: LogContext = {}): void {
  writeRecord("info", "server", operation, context);
}

export function logServerWarn(
  operation: string,
  error?: unknown,
  context: LogContext = {},
): void {
  writeRecord("warn", "server", operation, context, error);
}

export function logServerError(
  operation: string,
  error: unknown,
  context: LogContext = {},
): void {
  writeRecord("error", "server", operation, context, error);
}

/** Structured, low-cardinality operational measurements for Cloudflare Observability logs. */
export function logServerMetric(operation: string, context: LogContext = {}): void {
  writeRecord("info", "operational_metric", operation, context);
}
