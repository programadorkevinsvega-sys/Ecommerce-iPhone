import type { AdminUserRepository } from "./AdminUserManagement";
import type { AuditPort } from "./AuditPort";
import type { AdminPermissionRepository, PermissionOverride } from "./AdminPermissionRepository";
import type { AdminRole } from "../domain/AdminRole";
import { PERMISSIONS, type Permission, resolvePermissions } from "./Rbac";

export type PermissionState = "inherit" | "grant" | "deny";

export type AdminPermissionItem = Readonly<{
  permission: Permission;
  state: PermissionState;
  effective: boolean;
  roleGranted: boolean;
}>;

function requireId(value: string): string {
  const id = value.trim();
  if (!id) throw new Error("ID_REQUIRED");
  return id;
}

function validateOverrides(value: unknown): PermissionOverride[] {
  if (!Array.isArray(value)) throw new Error("INVALID_PERMISSIONS");
  const known = new Set<Permission>(Object.values(PERMISSIONS));
  const seen = new Set<Permission>();
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("INVALID_PERMISSIONS");
    const permission = String((entry as { permission?: unknown }).permission ?? "") as Permission;
    const granted = (entry as { granted?: unknown }).granted;
    if (!known.has(permission) || typeof granted !== "boolean" || seen.has(permission)) {
      throw new Error("INVALID_PERMISSIONS");
    }
    seen.add(permission);
    return { permission, granted };
  });
}

export class AdminPermissionManagement {
  constructor(
    private readonly users: AdminUserRepository,
    private readonly permissions: AdminPermissionRepository,
    private readonly audit: AuditPort,
  ) {}

  async get(targetIdInput: string, actorIdInput: string): Promise<ReadonlyArray<AdminPermissionItem>> {
    const targetId = requireId(targetIdInput);
    const actor = await this.requireUser(actorIdInput);
    const target = await this.requireUser(targetId);
    const actorOverrides = await this.permissions.getOverrides(actor.toPrimitives().id);
    const actorEffective = new Set(resolvePermissions(actor.role, actorOverrides));
    if (!actorEffective.has(PERMISSIONS.adminsManage)) throw new Error("FORBIDDEN");
    const overrides = await this.permissions.getOverrides(targetId);
    return this.catalog(target.role, overrides);
  }

  async update(targetIdInput: string, rawOverrides: unknown, actorIdInput: string): Promise<void> {
    const targetId = requireId(targetIdInput);
    const actorId = requireId(actorIdInput);
    const actor = await this.requireUser(actorId);
    const target = await this.requireUser(targetId);
    const overrides = validateOverrides(rawOverrides);

    if (targetId === actorId) throw new Error("ADMIN_SELF_PERMISSIONS_CHANGE_FORBIDDEN");
    const actorOverrides = await this.permissions.getOverrides(actorId);
    const actorEffective = new Set(resolvePermissions(actor.role, actorOverrides));
    if (!actorEffective.has(PERMISSIONS.adminsManage)) throw new Error("FORBIDDEN");
    if (target.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
      throw new Error("SUPER_ADMIN_PERMISSIONS_PROTECTED");
    }

    if (actor.role !== "SUPER_ADMIN") {
      for (const override of overrides) {
        if (!actorEffective.has(override.permission)) {
          throw new Error("PERMISSION_ESCALATION_FORBIDDEN");
        }
      }
    }

    const before = await this.permissions.getOverrides(targetId);
    await this.permissions.replaceOverrides(targetId, target.role === "SUPER_ADMIN" ? [] : overrides);
    await this.audit.audit(actorId, "ADMIN_PERMISSIONS_UPDATED", "admin_user", targetId, {
      previous: before,
      next: target.role === "SUPER_ADMIN" ? [] : overrides,
    });
  }

  private catalog(role: AdminRole, overrides: ReadonlyArray<PermissionOverride>): AdminPermissionItem[] {
    const map = new Map(overrides.map((override) => [override.permission, override.granted]));
    const effective = new Set(resolvePermissions(role, overrides));
    const rolePermissions = new Set(resolvePermissions(role, []));
    return Object.values(PERMISSIONS).map((permission) => {
      const granted = map.get(permission);
      return {
        permission,
        state: granted === undefined ? "inherit" : granted ? "grant" : "deny",
        effective: effective.has(permission),
        roleGranted: rolePermissions.has(permission),
      };
    });
  }

  private async requireUser(idInput: string) {
    const id = requireId(idInput);
    const user = await this.users.findById(id);
    if (!user || !user.active) throw new Error("ADMIN_NOT_FOUND");
    return user;
  }
}
