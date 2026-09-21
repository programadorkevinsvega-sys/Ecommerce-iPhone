import { describe, expect, it, vi } from "vitest";
import { AdminUser } from "../domain/AdminUser";
import { PERMISSIONS, ROLE_PERMISSIONS } from "./Rbac";
import { AdminPermissionManagement } from "./AdminPermissionManagement";
import type { AdminPermissionRepository } from "./AdminPermissionRepository";
import type { AdminUserRepository, AuditPort } from "./AdminUserManagement";

function admin(id: string, role: "SUPER_ADMIN" | "ADMIN" | "SALES" = "ADMIN") {
  return AdminUser.create(id, {
    email: `${id}@example.com`,
    passwordHash: "hash",
    role,
    firstName: "Admin",
    lastName: "User",
    active: true,
    failedLoginCount: 0,
  });
}

function setup(targetRole: "SUPER_ADMIN" | "ADMIN" | "SALES" = "SALES") {
  const actor = admin("actor", "ADMIN");
  const target = admin("target", targetRole);
  const overrides = new Map<string, { permission: keyof typeof PERMISSIONS extends never ? never : (typeof PERMISSIONS)[keyof typeof PERMISSIONS]; granted: boolean }[]>();
  const users: AdminUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(async (id: string) => id === actor.getId() ? actor : id === target.getId() ? target : null),
    list: vi.fn(),
    countActiveSuperAdmins: vi.fn(),
    save: vi.fn(),
    saveSuperAdminTransition: vi.fn(),
  };
  const permissions: AdminPermissionRepository = {
    getOverrides: vi.fn(async (id: string) => overrides.get(id) ?? []),
    replaceOverrides: vi.fn(async (id, next) => { overrides.set(id, [...next]); }),
  };
  const audit: AuditPort = { audit: vi.fn().mockResolvedValue(undefined) };
  return { actor, target, users, permissions, audit, service: new AdminPermissionManagement(users, permissions, audit) };
}

describe("AdminPermissionManagement", () => {
  it("allows an actor to grant only permissions they effectively possess", async () => {
    const context = setup();
    await context.service.update("target", [{ permission: PERMISSIONS.ordersRead, granted: true }], "actor");
    expect(context.permissions.replaceOverrides).toHaveBeenCalledWith("target", [{ permission: PERMISSIONS.ordersRead, granted: true }]);
  });

  it("rejects vertical privilege escalation", async () => {
    const context = setup();
    await expect(context.service.update("target", [{ permission: PERMISSIONS.adminsManage, granted: true }], "actor"))
      .rejects.toThrow("PERMISSION_ESCALATION_FORBIDDEN");
  });

  it("forbids self permission changes", async () => {
    const context = setup();
    await expect(context.service.update("actor", [{ permission: PERMISSIONS.ordersRead, granted: false }], "actor"))
      .rejects.toThrow("ADMIN_SELF_PERMISSIONS_CHANGE_FORBIDDEN");
  });

  it("protects SUPER_ADMIN permission overrides from non-super administrators", async () => {
    const context = setup("SUPER_ADMIN");
    await expect(context.service.update("target", [{ permission: PERMISSIONS.ordersRead, granted: false }], "actor"))
      .rejects.toThrow("SUPER_ADMIN_PERMISSIONS_PROTECTED");
  });

  it("keeps SUPER_ADMIN permissions fixed even when a super administrator updates them", async () => {
    const context = setup("SUPER_ADMIN");
    const superActor = admin("actor", "SUPER_ADMIN");
    (context.users.findById as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) =>
      id === superActor.getId() || id === context.target.getId() ? (id === superActor.getId() ? superActor : context.target) : null,
    );
    await context.service.update("target", [{ permission: PERMISSIONS.productsRead, granted: false }], "actor");
    expect(context.permissions.replaceOverrides).toHaveBeenCalledWith("target", []);
  });
});