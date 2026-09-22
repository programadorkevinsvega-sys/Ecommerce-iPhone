import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireNotificationRecipient } from "../../../../../lib/notificationAuth";
import { notificationInboxApplication } from "../../../../../lib/notificationsApplication";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    const { env } = getCloudflareContext();
    const { id } = await context.params;
    const changed = await notificationInboxApplication(env).markRead(recipient, id);
    if (!changed) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && error.message === "INVALID_SCOPE" ? 400 : 401;
    return NextResponse.json({ error: status === 400 ? "Invalid notification scope." : "Authentication required." }, { status });
  }
}
