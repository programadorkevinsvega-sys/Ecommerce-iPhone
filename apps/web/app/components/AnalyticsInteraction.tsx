"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import type { AnalyticsEventType, AnalyticsPayload } from "../../../../modules/analytics/domain/AnalyticsEvent";

type AnalyticsInteractionProps = Readonly<{
  eventType: AnalyticsEventType;
  payload: AnalyticsPayload;
  children: ReactNode;
  className?: string | undefined;
  href?: string | undefined;
  prefetch?: boolean | undefined;
}>;

type AnalyticsEventOnMountProps = Readonly<{
  eventType: AnalyticsEventType;
  payload: AnalyticsPayload;
}>;

export function trackAnalyticsEvent(eventType: AnalyticsEventType, payload: AnalyticsPayload): void {
  const body = JSON.stringify({
    eventId: crypto.randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    payload,
  });

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

export function AnalyticsEventOnMount({ eventType, payload }: AnalyticsEventOnMountProps) {
  const serializedPayload = useMemo(() => JSON.stringify(payload), [payload]);

  useEffect(() => {
    trackAnalyticsEvent(eventType, JSON.parse(serializedPayload) as AnalyticsPayload);
  }, [eventType, serializedPayload]);

  return null;
}

export function AnalyticsInteraction({
  eventType,
  payload,
  children,
  className,
  href,
  prefetch = false,
}: AnalyticsInteractionProps) {
  if (href === undefined) {
    return (
      <span className={className} onClick={() => trackAnalyticsEvent(eventType, payload)}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      onClick={() => trackAnalyticsEvent(eventType, payload)}
    >
      {children}
    </Link>
  );
}
