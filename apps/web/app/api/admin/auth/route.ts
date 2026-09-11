import { NextResponse } from "next/server";
import { currentAdmin, logoutAdmin } from "../../../../lib/adminAuth";

export async function GET() {
  const admin = await currentAdmin();
  return NextResponse.json({ authenticated: Boolean(admin), admin });
}

export async function DELETE() {
  await logoutAdmin();
  return NextResponse.json({ ok: true });
}
