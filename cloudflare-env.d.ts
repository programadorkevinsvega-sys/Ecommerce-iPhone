import type { D1Database, R2Bucket, Queue } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    MEDIA_BUCKET: R2Bucket;
    EVENTS_QUEUE: Queue;
    APP_ENV: string;
    ALLOWED_ORIGIN: string;
  }
}

export {};
