export {};

declare global {
  var WebSocketPair: {
    new (): {
      0: WebSocket;
      1: WebSocket;
    };
  };

  interface ResponseInit {
    webSocket?: WebSocket | null;
  }
}

declare module "cloudflare:workers" {
  abstract class DurableObject<Env = unknown> {
    protected readonly ctx: DurableObjectState;
    protected readonly env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }

  export { DurableObject };
}
