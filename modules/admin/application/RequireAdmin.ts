import { hasPermission } from "./Rbac";
import type { CurrentAdmin } from "./ResolveCurrentAdmin";

export class RequireAdmin {
  constructor(private readonly resolve: { execute(token: string | null | undefined): Promise<CurrentAdmin | null> }) {}

  async execute(token: string | null | undefined, permission?: string): Promise<CurrentAdmin> {
    const admin = await this.resolve.execute(token);
    if (!admin) throw new Error("UNAUTHORIZED");
    if (admin.role === "TECHNICIAN") throw new Error("FORBIDDEN");
    if (permission && !hasPermission(admin.role, permission)) throw new Error("FORBIDDEN");
    return admin;
  }
}
