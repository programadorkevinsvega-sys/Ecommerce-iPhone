import { DurableObject } from "cloudflare:workers";
import type { NotificationInboxItem } from "../domain/NotificationEvent";

export class NotificationHub extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/publish") {
      const item = await request.json() as NotificationInboxItem;
      const message = JSON.stringify({
        type: "notification",
        notificationId: item.id,
        eventId: item.eventId,
        eventType: item.eventType,
        eventVersion: item.eventVersion,
        createdAt: item.createdAt,
        title: item.title,
        body: item.body,
        data: item.payload,
      });
      for (const websocket of this.ctx.getWebSockets()) {
        try {
          websocket.send(message);
        } catch {
          try { websocket.close(1011, "Delivery failed"); } catch {}
        }
      }
      return new Response(null, { status: 204 });
    }

    if (request.method === "GET" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(_websocket: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") return;
    try {
      const payload = JSON.parse(message) as { type?: string };
      if (payload.type === "ping") return;
      if (payload.type === "ack") return;
    } catch {
      return;
    }
  }

  webSocketClose(websocket: WebSocket, _code: number, _reason: string, _wasClean: boolean): void {
    try { websocket.close(); } catch {}
  }

  webSocketError(websocket: WebSocket): void {
    try { websocket.close(1011, "Socket error"); } catch {}
  }
}
