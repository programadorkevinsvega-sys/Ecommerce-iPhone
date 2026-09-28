import { NextResponse } from "next/server";
import { cloudflareEnv } from "../../../../../lib/cloudflareContext";
import { bootstrapAdmin } from "../../../../../lib/adminAuth";

export async function POST(request: Request) {
  try {
    const env = cloudflareEnv();
    const email = env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = env.ADMIN_PASSWORD;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Admin bootstrap configuration is missing" },
        { status: 503 },
      );
    }

    const id = await bootstrapAdmin(
      {
        email,
        password,
        role: "SUPER_ADMIN",
      },
      request.headers.get("X-Admin-Bootstrap-Token"),
    );
    return NextResponse.json({ created: true, adminId: id }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "NOT_FOUND" ? 404 : code === "ADMIN_ALREADY_EXISTS" ? 409 : code === "INVALID_ADMIN_DATA" || code === "INVALID_ADMIN_PASSWORD" || code === "INVALID_ROLE" || code === "INVALID_ADMIN_EMAIL" || code === "INVALID_ADMIN_NAME" || code === "INVALID_PASSWORD_HASH" ? 400 : 500;
    return NextResponse.json(
      {
        error:
          status === 404
            ? "Not found"
            : status === 409
              ? "Admin already exists"
              : status === 400
                ? "Invalid admin configuration"
                : "Unable to bootstrap administrator",
      },
      { status },
    );
  }
}
