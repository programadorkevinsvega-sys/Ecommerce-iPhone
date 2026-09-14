import { getCloudflareContext } from "@opennextjs/cloudflare";
export function runtimeEnv(): CloudflareEnv { return getCloudflareContext().env; }
