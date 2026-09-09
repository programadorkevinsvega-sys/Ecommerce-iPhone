export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SALES",
  "SUPPORT",
  "INVENTORY",
  "FINANCE",
  "CONTENT_EDITOR",
  "TECHNICIAN",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type Permission = `${string}:${string}`;

export interface AuthorizationPolicy {
  can(role: AdminRole, permission: Permission): boolean;
}

export class ExplicitAuthorizationPolicy implements AuthorizationPolicy {
  constructor(private readonly grants: Readonly<Record<AdminRole, readonly Permission[]>>) {}

  can(role: AdminRole, permission: Permission): boolean {
    return this.grants[role]?.includes(permission) ?? false;
  }
}
