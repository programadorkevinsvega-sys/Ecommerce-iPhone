import { NextResponse } from "next/server";
import { requireNotificationRecipient } from "../../../lib/notificationAuth";
import { listNotifications } from "../../../lib/api/notifications";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const unreadOnly = url.searchParams.get("unread") === "true";
    return NextResponse.json(await listNotifications(recipient, limit, cursor, unreadOnly), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "INVALID_SCOPE" ? 400 : code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      { error: status === 400 ? "Invalid notification scope." : status === 403 ? "Forbidden." : "Authentication required." },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
