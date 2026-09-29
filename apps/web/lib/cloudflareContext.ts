import { getCloudflareContext } from "@opennextjs/cloudflare";

export function cloudflareEnv(): CloudflareEnv {
  return getCloudflareContext().env;
}


export function cloudflareWaitUntil(promise: Promise<unknown>): void {
  getCloudflareContext().ctx.waitUntil(promise);
}
