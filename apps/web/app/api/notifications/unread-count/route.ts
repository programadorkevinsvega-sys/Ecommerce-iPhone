import { NextResponse } from "next/server";
import { requireNotificationRecipient } from "../../../../lib/notificationAuth";
import { unreadNotificationCount } from "../../../../lib/api/notifications";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    const unread = await unreadNotificationCount(recipient);
    return NextResponse.json({ unread }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "INVALID_SCOPE" ? 400 : code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 400 ? "Invalid notification scope." : status === 403 ? "Forbidden." : "Authentication required." }, { status });
  }
}
