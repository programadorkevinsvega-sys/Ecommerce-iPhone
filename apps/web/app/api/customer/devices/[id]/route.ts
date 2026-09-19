import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json({ error: "Los dispositivos se modifican por personal autorizado." }, { status: 405, headers: { Allow: "GET" } });
}

export async function DELETE() {
  return NextResponse.json({ error: "Los dispositivos se archivan por personal autorizado." }, { status: 405, headers: { Allow: "GET" } });
}
