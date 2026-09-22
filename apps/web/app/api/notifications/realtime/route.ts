import { requireNotificationRecipient } from "../../../../lib/notificationAuth";
import { upgradeNotificationRealtime } from "../../../../lib/api/notifications";

export async function GET(request: Request) {
  try {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required.", { status: 426 });
    }
    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    return upgradeNotificationRealtime(request, recipient);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "INVALID_SCOPE" ? 400 : code === "FORBIDDEN" ? 403 : 401;
    return new Response(status === 400 ? "Invalid notification scope." : status === 403 ? "Forbidden." : "Authentication required.", { status });
  }
}
