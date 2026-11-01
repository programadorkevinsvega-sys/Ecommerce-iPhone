import { isValidRequestId } from "./requestCorrelation";

const TRACE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function resolveQueueCorrelation(
  input: Readonly<{
    requestId?: string | undefined;
    eventId?: string | undefined;
    outboxId?: string | undefined;
  }>,
  fallback?: string,
): string | undefined {
  const requestId = input.requestId?.trim();
  if (isValidRequestId(requestId)) return requestId;

  for (const candidate of [input.eventId, input.outboxId, fallback]) {
    const value = candidate?.trim();
    if (value && TRACE_ID_PATTERN.test(value)) return value;
  }

  return undefined;
}
