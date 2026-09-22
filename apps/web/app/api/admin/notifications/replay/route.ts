import { NextResponse } from "next/server";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";
import { replayNotificationDeadLetter } from "../../../../../lib/api/notifications";

export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(PERMISSIONS.notificationsReplay);
    const body = await request.json() as { id?: string };
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Dead-letter id is required." }, { status: 422 });
    await replayNotificationDeadLetter(id, admin.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "NOTIFICATION_DLQ_NOT_FOUND") return NextResponse.json({ error: "Dead-letter item not found." }, { status: 404 });
    if (code === "NOTIFICATION_DLQ_ALREADY_REPLAYED") return NextResponse.json({ error: "Dead-letter item was already replayed." }, { status: 409 });
    if (code === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
