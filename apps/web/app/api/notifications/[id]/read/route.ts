import { NextResponse } from "next/server";
import { requireNotificationRecipient } from "../../../../../lib/notificationAuth";
import { markNotificationRead } from "../../../../../lib/api/notifications";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    const { id } = await context.params;
    const changed = await markNotificationRead(recipient, id);
    if (!changed) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "INVALID_SCOPE" ? 400 : code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 400 ? "Invalid notification scope." : status === 403 ? "Forbidden." : "Authentication required." }, { status });
  }
}
