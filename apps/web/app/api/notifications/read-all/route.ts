import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireNotificationRecipient } from "../../../../lib/notificationAuth";
import { notificationInboxApplication } from "../../../../lib/notificationsApplication";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    const { env } = getCloudflareContext();
    const count = await notificationInboxApplication(env).markAllRead(recipient);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    const status = error instanceof Error && error.message === "INVALID_SCOPE" ? 400 : 401;
    return NextResponse.json({ error: status === 400 ? "Invalid notification scope." : "Authentication required." }, { status });
  }
}
