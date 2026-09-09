import { ADMIN_ROLES, type AdminRole } from "../domain/AdminRole";

export { ADMIN_ROLES };
export type { AdminRole };
export type Permission = `${string}:${string}`;

export interface AuthorizationPolicy { can(role: AdminRole, permission: Permission): boolean; }

export class ExplicitAuthorizationPolicy implements AuthorizationPolicy {
  constructor(private readonly grants: Readonly<Record<AdminRole, readonly Permission[]>>) {}
  can(role: AdminRole, permission: Permission): boolean { return this.grants[role]?.includes(permission) ?? false; }
}
