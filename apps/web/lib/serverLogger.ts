type LogContext = Readonly<Record<string, string | number | boolean | null | undefined>>;

function serializeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return { message: String(error) };
}

export function logServerError(
  operation: string,
  error: unknown,
  context: LogContext = {},
): void {
  globalThis["console"]["error"](
    JSON.stringify({
      level: "error",
      source: "server",
      operation,
      ...context,
      error: serializeError(error),
    }),
  );
}
