import { NextResponse } from "next/server";
import { requireNotificationRecipient } from "../../../../lib/notificationAuth";
import { getNotificationPreferences, setNotificationPreference } from "../../../../lib/api/notifications";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    return NextResponse.json({ items: await getNotificationPreferences(recipient) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "INVALID_SCOPE" ? 400 : code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 400 ? "Invalid notification scope." : status === 403 ? "Forbidden." : "Authentication required." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const recipient = await requireNotificationRecipient(url.searchParams.get("scope"));
    const body = await request.json() as { channel?: string; eventType?: string; enabled?: boolean };
    if (
      (body.channel !== "EMAIL" && body.channel !== "IN_APP") ||
      typeof body.eventType !== "string" ||
      !/^[A-Za-z0-9_.*:-]{1,120}$/.test(body.eventType) ||
      typeof body.enabled !== "boolean"
    ) {
      return NextResponse.json({ error: "Invalid notification preference." }, { status: 422 });
    }

    await setNotificationPreference(recipient, body.channel, body.eventType, body.enabled);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "INVALID_SCOPE" ? 400 : code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 400 ? "Invalid notification scope." : status === 403 ? "Forbidden." : "Authentication required." }, { status });
  }
}
