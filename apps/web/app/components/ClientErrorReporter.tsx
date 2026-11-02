"use client";

import { useEffect, useRef } from "react";
import { normalizeOperationalRoute } from "../../lib/operationalTelemetry";

export default function ClientErrorReporter({ digest }: { digest?: string | undefined }) {
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;

    const safeDigest =
      typeof digest === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(digest) ? digest : null;
    const payload = {
      digest: safeDigest,
      routeGroup: normalizeOperationalRoute(window.location.pathname),
    };

    void fetch("/api/observability/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }, [digest]);

  return null;
}
