"use client";

import { useReportWebVitals } from "next/web-vitals";
import { normalizeWebVitalRoute } from "../../../../modules/analytics/application/WebVitals";

const configuredRate = Number(process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE ?? "0.1");
const sampleRate = Number.isFinite(configuredRate) ? Math.max(0, Math.min(1, configuredRate)) : 0.1;
const sampledThisPage = Math.random() < sampleRate;

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!sampledThisPage) return;
    if (metric.name !== "LCP" && metric.name !== "INP" && metric.name !== "CLS") return;
    const width = window.innerWidth;
    const deviceType = width < 600 ? "mobile" : width < 1024 ? "tablet" : "desktop";
    const payload = {
      metric: metric.name, metricId: metric.id, value: metric.value,
      route: normalizeWebVitalRoute(window.location.pathname), deviceType,
    };
    void fetch("/api/analytics/web-vitals", {
      method: "POST", headers: { "content-type": "application/json" },
      credentials: "same-origin", cache: "no-store", keepalive: true, body: JSON.stringify(payload),
    }).catch(() => undefined);
  });
  return null;
}
