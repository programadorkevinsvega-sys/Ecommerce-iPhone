import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireNotificationRecipient } from "../../../../lib/notificationAuth";

export async function GET(request: Request) {
  try {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required.", { status: 426 });
    }

    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    const { env } = getCloudflareContext();
    const id = env.NOTIFICATION_HUB.idFromName(
      `notification:${recipient.type}:${recipient.id}`,
    );
    const stub = env.NOTIFICATION_HUB.get(id);
    return stub.fetch(new Request("https://notification-hub/realtime", {
      method: "GET",
      headers: request.headers,
    }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "INVALID_SCOPE" ? 400 : 401;
    return new Response(
      status === 400 ? "Invalid notification scope." : "Authentication required.",
      { status },
    );
  }
}
