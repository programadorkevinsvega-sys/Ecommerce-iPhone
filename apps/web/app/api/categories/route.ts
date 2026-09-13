import { NextResponse } from "next/server";
import { listPublicCategories } from "../../../lib/catalog";

export async function GET(): Promise<Response> {
  try {
    return NextResponse.json(
      { items: await listPublicCategories() },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load categories" }, { status: 500 });
  }
}
