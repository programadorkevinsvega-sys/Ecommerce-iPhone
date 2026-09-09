import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return NextResponse.json({
    status: "ok",
    service: "ecommerce-iphone-web",
    timestamp: new Date().toISOString(),
  });
}
