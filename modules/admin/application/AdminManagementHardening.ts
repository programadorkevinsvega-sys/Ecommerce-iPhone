import type { AdminRole } from "../domain/AdminRole";
import { AdminUser } from "../domain/AdminUser";

export type AdminManagementRepository = {
  findById(id: string): Promise<AdminUser | null>;
  countActiveSuperAdmins(): Promise<number>;
  saveUser(user: AdminUser): Promise<void>;
  revokeAllSessions(adminUserId: string): Promise<void>;
  audit(adminUserId: string | null, action: string, resourceType: string, resourceId: string | null, payload: unknown, ipHash?: string): Promise<void>;
};

export class AdminManagementHardening {
  constructor(private readonly repository: AdminManagementRepository) {}

  async deactivate(actor: AdminUser, targetId: string, ipHash?: string): Promise<void> {
    this.assertCanManage(actor);
    const target = await this.requireTarget(targetId);
    const id = target.getId();
    if (id === actor.getId()) throw new Error("ADMIN_SELF_DEACTIVATION_FORBIDDEN");
    if (target.role === "SUPER_ADMIN" && target.active && (await this.repository.countActiveSuperAdmins()) <= 1) throw new Error("LAST_SUPER_ADMIN_PROTECTED");
    target.deactivate();
    await this.repository.saveUser(target);
    await this.repository.revokeAllSessions(id);
    await this.repository.audit(actor.getId(), "ADMIN_DEACTIVATED", "admin_user", id, { role: target.role }, ipHash);
  }

  async activate(actor: AdminUser, targetId: string, ipHash?: string): Promise<void> {
    this.assertCanManage(actor);
    const target = await this.requireTarget(targetId);
    target.activate();
    await this.repository.saveUser(target);
    await this.repository.audit(actor.getId(), "ADMIN_ACTIVATED", "admin_user", target.getId(), { role: target.role }, ipHash);
  }

  async changeRole(actor: AdminUser, targetId: string, role: AdminRole, ipHash?: string): Promise<void> {
    this.assertCanManage(actor);
    const target = await this.requireTarget(targetId);
    const id = target.getId();
    if (actor.getId() === id) throw new Error("ADMIN_SELF_ROLE_CHANGE_FORBIDDEN");
    const previousRole = target.role;
    if (previousRole === "SUPER_ADMIN" && role !== "SUPER_ADMIN" && (await this.repository.countActiveSuperAdmins()) <= 1) throw new Error("LAST_SUPER_ADMIN_PROTECTED");
    if (previousRole === role) return;
    target.changeRole(role);
    await this.repository.saveUser(target);
    await this.repository.revokeAllSessions(id);
    await this.repository.audit(actor.getId(), "ADMIN_ROLE_CHANGED", "admin_user", id, { previousRole, role }, ipHash);
  }

  private async requireTarget(id: string): Promise<AdminUser> {
    const target = await this.repository.findById(id);
    if (!target) throw new Error("ADMIN_NOT_FOUND");
    return target;
  }

  private assertCanManage(actor: AdminUser): void {
    if (!actor.active || actor.role !== "SUPER_ADMIN") throw new Error("ADMIN_MANAGEMENT_FORBIDDEN");
  }
}
