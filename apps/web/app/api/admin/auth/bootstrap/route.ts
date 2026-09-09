import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminUser } from "../../../../../../../modules/admin/domain/AdminUser";
import type { AdminRole } from "../../../../../../../modules/admin/application/Rbac";
import { D1AdminRepository } from "../../../../../../../modules/admin/infrastructure/D1AdminRepository";
import { hashPassword } from "../../../../../../../modules/admin/infrastructure/AdminSecurity";

export async function POST(request: Request) {
  try {
    const { env } = getCloudflareContext();
    const bootstrapToken = (env as CloudflareEnv & { ADMIN_BOOTSTRAP_TOKEN?: string }).ADMIN_BOOTSTRAP_TOKEN;
    const supplied = request.headers.get("X-Admin-Bootstrap-Token");
    if (!bootstrapToken || !supplied || supplied !== bootstrapToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const role = String(body.role ?? "SUPER_ADMIN") as AdminRole;
    if (!email || !password || !firstName || !lastName) return NextResponse.json({ error: "email, password, firstName and lastName are required" }, { status: 400 });
    if (!['SUPER_ADMIN','ADMIN','MANAGER','SALES','SUPPORT','INVENTORY','FINANCE','CONTENT_EDITOR','TECHNICIAN'].includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    const repo = new D1AdminRepository(env.DB);
    if (await repo.findByEmail(email)) return NextResponse.json({ error: "Admin already exists" }, { status: 409 });
    const user = AdminUser.create(crypto.randomUUID(), { email, passwordHash: await hashPassword(password), role, firstName, lastName, active: true, failedLoginCount: 0 });
    await repo.saveUser(user);
    await repo.audit(user.getId(), "ADMIN_BOOTSTRAPPED", "admin_user", user.getId(), { role, email });
    return NextResponse.json({ created: true, adminId: user.getId() }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to bootstrap admin" }, { status: 400 }); }
}
