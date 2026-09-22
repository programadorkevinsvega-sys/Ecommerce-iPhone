import { NextResponse } from "next/server";
import { requireNotificationRecipient } from "../../../../lib/notificationAuth";
import { notificationInboxApplication } from "../../../../lib/notificationsApplication";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    const { env } = getCloudflareContext();
    const unread = await notificationInboxApplication(env).unreadCount(recipient);
    return NextResponse.json({ unread }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof Error && error.message === "INVALID_SCOPE" ? 400 : 401;
    return NextResponse.json({ error: status === 400 ? "Invalid notification scope." : "Authentication required." }, { status });
  }
}
