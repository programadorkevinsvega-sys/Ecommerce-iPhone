import type { Permission } from "./Rbac";
import type { CurrentAdmin } from "./ResolveCurrentAdmin";

export class RequireAdmin {
  constructor(private readonly resolve: { execute(token: string | null | undefined): Promise<CurrentAdmin | null> }) {}

  async execute(token: string | null | undefined, permission?: string): Promise<CurrentAdmin> {
    const admin = await this.resolve.execute(token);
    if (!admin) throw new Error("UNAUTHORIZED");
    if (permission && !admin.permissions.includes(permission as Permission)) throw new Error("FORBIDDEN");
    return admin;
  }
}
