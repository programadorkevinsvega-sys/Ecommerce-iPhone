export interface Env {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  EVENTS_QUEUE: Queue;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
