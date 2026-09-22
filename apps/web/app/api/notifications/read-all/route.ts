import { NextResponse } from "next/server";
import { requireNotificationRecipient } from "../../../../lib/notificationAuth";
import { markAllNotificationsRead } from "../../../../lib/api/notifications";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    const count = await markAllNotificationsRead(recipient);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "INVALID_SCOPE" ? 400 : code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 400 ? "Invalid notification scope." : status === 403 ? "Forbidden." : "Authentication required." }, { status });
  }
}
