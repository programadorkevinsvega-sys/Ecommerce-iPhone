declare module "cloudflare:workers" {
  abstract class DurableObject<Env = unknown> {
    protected readonly ctx: DurableObjectState;
    protected readonly env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }

  function waitUntil(promise: Promise<unknown>): void;

  export { DurableObject, waitUntil };
}
