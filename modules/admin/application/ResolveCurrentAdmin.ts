import type { AdminUser } from "../domain/AdminUser";
import type { AdminSessionRepository } from "./AdminSessionRepository";
import type { AdminPermissionRepository } from "./AdminPermissionRepository";
import { resolvePermissions, type Permission } from "./Rbac";

export type CurrentAdmin = Readonly<{ id: string; email: string; role: AdminUser["role"]; firstName: string; lastName: string; permissions: readonly Permission[] }>;

export class ResolveCurrentAdmin {
  constructor(
    private readonly sessions: AdminSessionRepository,
    private readonly hashToken: (value: string) => Promise<string>,
    private readonly permissions: AdminPermissionRepository,
  ) {}

  async execute(token: string | null | undefined): Promise<CurrentAdmin | null> {
    if (!token) return null;
    const found = await this.sessions.findByTokenHash(await this.hashToken(token));
    if (!found) return null;
    const value = found.user.toPrimitives();
    const overrides = await this.permissions.getOverrides(value.id);
    return {
      id: value.id,
      email: value.email,
      role: value.role,
      firstName: value.firstName,
      lastName: value.lastName,
      permissions: resolvePermissions(value.role, overrides),
    };
  }
}
