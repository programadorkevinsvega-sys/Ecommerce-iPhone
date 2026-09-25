declare var WebSocketPair: {
  new (): [WebSocket, WebSocket];
};

declare module "cloudflare:workers" {
  abstract class DurableObject<Env = unknown> {
    protected readonly ctx: DurableObjectState;
    protected readonly env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }

  export { DurableObject };
}
