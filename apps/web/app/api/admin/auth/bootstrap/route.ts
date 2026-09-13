import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { bootstrapAdmin } from "../../../../../lib/adminAuth";

export async function POST(request: Request) {
  try {
    const { env } = getCloudflareContext();
    const email = env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = env.ADMIN_PASSWORD;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Admin bootstrap configuration is missing" },
        { status: 503 },
      );
    }

    let body: Record<string, unknown> = {};

    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
    }

    const id = await bootstrapAdmin(
      {
        email,
        password,
        firstName:
          typeof body.firstName === "string" && body.firstName.trim()
            ? body.firstName.trim()
            : "Administrador",
        lastName:
          typeof body.lastName === "string" && body.lastName.trim()
            ? body.lastName.trim()
            : "Principal",
        role: "SUPER_ADMIN",
      },
      request.headers.get("X-Admin-Bootstrap-Token"),
    );
    return NextResponse.json({ created: true, adminId: id }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "NOT_FOUND" ? 404 : code === "ADMIN_ALREADY_EXISTS" ? 409 : 400;
    return NextResponse.json(
      {
        error:
          status === 404
            ? "Not found"
            : status === 409
              ? "Admin already exists"
              : "Invalid admin configuration",
      },
      { status },
    );
  }
}
