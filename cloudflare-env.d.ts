import type { D1Database, DurableObjectNamespace, Queue } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    MEDIA_BUCKET: R2Bucket;
    EVENTS_QUEUE: Queue;
    ANALYTICS_QUEUE: Queue;
    NOTIFICATIONS_QUEUE: Queue;
    NOTIFICATIONS_DLQ_QUEUE: Queue;
    NOTIFICATION_HUB: DurableObjectNamespace;
    SENSITIVE_RATE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
    APP_ENV: string;
    ALLOWED_ORIGIN: string;
    ADMIN_EMAIL?: string;
    ADMIN_PASSWORD?: string;
    ADMIN_BOOTSTRAP_TOKEN?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    WOMPI_PUBLIC_KEY?: string;
    WOMPI_PRIVATE_KEY?: string;
    WOMPI_INTEGRITY_SECRET?: string;
    WOMPI_EVENTS_SECRET?: string;
  }
}

export {};
