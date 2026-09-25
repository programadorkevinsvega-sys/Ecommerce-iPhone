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
