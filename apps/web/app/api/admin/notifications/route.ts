import { NextResponse } from "next/server";

import { requireAdmin } from "../../../../lib/adminAuth";

export async function GET(request: Request) {
  try {
    const { env } = await requireAdmin("dashboard:read");
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    const rows = await env.DB.prepare("SELECT d.id,d.outbox_id,d.channel,d.recipient,d.template,d.provider,d.provider_message_id,d.status,d.attempts,d.error_message,d.created_at,o.event_type,o.aggregate_id FROM notification_deliveries d JOIN notification_outbox o ON o.id=d.outbox_id ORDER BY d.created_at DESC LIMIT ?").bind(limit).all();
    const pending = await env.DB.prepare("SELECT status,COUNT(*) AS count FROM notification_outbox GROUP BY status").all();
    return NextResponse.json({ deliveries: rows.results, queue: pending.results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "FORBIDDEN" ? "Forbidden" : "Authentication required" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 },
    );
  }
}
