import { AdminUser } from "../domain/AdminUser";
import type { AdminRole } from "../domain/AdminRole";
import { ADMIN_ROLES } from "../domain/AdminRole";

export interface AdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  list(): Promise<ReadonlyArray<AdminUser>>;
  countActiveSuperAdmins(): Promise<number>;
  save(user: AdminUser): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

export interface SessionRepository {
  revokeAllSessions(adminUserId: string): Promise<void>;
}

export interface AuditPort {
  audit(
    adminUserId: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    payload: unknown,
  ): Promise<void>;
}

export type AdminUserListItem = Readonly<{
  id: string;
  email: string;
  role: AdminRole;
  firstName: string;
  lastName: string;
  active: boolean;
  failedLoginCount: number;
  lockedUntil: string | undefined;
  lastLoginAt: string | undefined;
  createdAt: string;
  updatedAt: string;
}>;

function requireString(value: unknown, error: string): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(error);
  return result;
}

function parseRole(value: unknown, fallback: AdminRole = "ADMIN"): AdminRole {
  const role = String(value ?? fallback).trim() as AdminRole;
  if (!ADMIN_ROLES.includes(role)) throw new Error("INVALID_ROLE");
  return role;
}

function toListItem(user: AdminUser): AdminUserListItem {
  const value = user.toPrimitives();
  return value;
}

export class AdminUserManagement {
  constructor(
    private readonly users: AdminUserRepository,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionRepository,
    private readonly audit: AuditPort,
  ) {}

  async list(): Promise<ReadonlyArray<AdminUserListItem>> {
    return (await this.users.list()).map(toListItem);
  }

  async create(input: Record<string, unknown>, actorId: string): Promise<string> {
    const actor = await this.requireActor(actorId);
    const email = requireString(input.email, "INVALID_ADMIN_DATA").toLowerCase();
    const password = requireString(input.password, "INVALID_ADMIN_DATA");
    const firstName = requireString(input.firstName, "INVALID_ADMIN_DATA");
    const lastName = requireString(input.lastName, "INVALID_ADMIN_DATA");
    const role = parseRole(input.role);

    if (await this.users.findByEmail(email)) throw new Error("ADMIN_ALREADY_EXISTS");

    const user = AdminUser.create(crypto.randomUUID(), {
      email,
      passwordHash: await this.passwords.hash(password),
      role,
      firstName,
      lastName,
      active: true,
      failedLoginCount: 0,
    });

    await this.users.save(user);
    await this.audit.audit(actor.getId(), "ADMIN_USER_CREATED", "admin_user", user.getId(), { email, role });
    return user.getId();
  }

  async update(input: Record<string, unknown>, actorId: string): Promise<void> {
    const actor = await this.requireActor(actorId);
    const id = requireString(input.id, "ID_REQUIRED");
    const user = await this.requireTarget(id);
    const current = user.toPrimitives();
    const role = input.role === undefined ? current.role : parseRole(input.role);
    const active = input.active === undefined ? current.active : input.active === true;

    if (id === actor.getId() && !active) throw new Error("SELF_DEACTIVATION_FORBIDDEN");
    if (id === actor.getId() && role !== actor.role) throw new Error("ADMIN_SELF_ROLE_CHANGE_FORBIDDEN");
    if (current.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN" && (await this.users.countActiveSuperAdmins()) <= 1) {
      throw new Error("LAST_SUPER_ADMIN_PROTECTED");
    }

    let passwordHash = current.passwordHash;
    if (typeof input.password === "string" && input.password.length > 0) {
      passwordHash = await this.passwords.hash(input.password);
    }

    const email = input.email === undefined ? current.email : requireString(input.email, "INVALID_ADMIN_DATA").toLowerCase();
    if (email !== current.email) {
      const existing = await this.users.findByEmail(email);
      if (existing && existing.getId() !== id) throw new Error("ADMIN_ALREADY_EXISTS");
    }

    const next = AdminUser.create(current.id, {
      ...current,
      email,
      firstName: input.firstName === undefined ? current.firstName : requireString(input.firstName, "INVALID_ADMIN_DATA"),
      lastName: input.lastName === undefined ? current.lastName : requireString(input.lastName, "INVALID_ADMIN_DATA"),
      role,
      active,
      passwordHash,
    });

    await this.users.save(next);

    if (passwordHash !== current.passwordHash || role !== current.role || active !== current.active) {
      await this.sessions.revokeAllSessions(id);
    }

    await this.audit.audit(actor.getId(), "ADMIN_USER_UPDATED", "admin_user", id, {
      fields: Object.keys(input).filter((field) => field !== "password"),
    });
  }

  async activate(targetId: string, actorId: string): Promise<void> {
    const actor = await this.requireActor(actorId);
    const target = await this.requireTarget(targetId);
    target.activate();
    await this.users.save(target);
    await this.audit.audit(actor.getId(), "ADMIN_ACTIVATED", "admin_user", target.getId(), { role: target.role });
  }

  async deactivate(targetId: string, actorId: string): Promise<void> {
    const actor = await this.requireActor(actorId);
    const target = await this.requireTarget(targetId);
    const id = target.getId();

    if (id === actor.getId()) throw new Error("SELF_DEACTIVATION_FORBIDDEN");
    if (target.role === "SUPER_ADMIN" && target.active && (await this.users.countActiveSuperAdmins()) <= 1) {
      throw new Error("LAST_SUPER_ADMIN_PROTECTED");
    }

    target.deactivate();
    await this.users.save(target);
    await this.sessions.revokeAllSessions(id);
    await this.audit.audit(actor.getId(), "ADMIN_DEACTIVATED", "admin_user", id, { role: target.role });
  }

  async changeRole(targetId: string, roleInput: unknown, actorId: string): Promise<void> {
    const actor = await this.requireActor(actorId);
    const target = await this.requireTarget(targetId);
    const role = parseRole(roleInput, target.role);
    const id = target.getId();

    if (id === actor.getId()) throw new Error("ADMIN_SELF_ROLE_CHANGE_FORBIDDEN");
    if (target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN" && (await this.users.countActiveSuperAdmins()) <= 1) {
      throw new Error("LAST_SUPER_ADMIN_PROTECTED");
    }
    if (target.role === role) return;

    const previousRole = target.role;
    target.changeRole(role);
    await this.users.save(target);
    await this.sessions.revokeAllSessions(id);
    await this.audit.audit(actor.getId(), "ADMIN_ROLE_CHANGED", "admin_user", id, { previousRole, role });
  }

  async resetPassword(targetId: string, password: string, actorId: string): Promise<void> {
    const actor = await this.requireActor(actorId);
    const target = await this.requireTarget(targetId);
    const value = requireString(password, "INVALID_PASSWORD");
    const current = target.toPrimitives();
    const passwordHash = await this.passwords.hash(value);
    const next = AdminUser.create(current.id, { ...current, passwordHash });

    await this.users.save(next);
    await this.sessions.revokeAllSessions(target.getId());
    await this.audit.audit(actor.getId(), "ADMIN_PASSWORD_RESET", "admin_user", target.getId(), {});
  }

  private async requireActor(id: string): Promise<AdminUser> {
    const actorId = id.trim();
    if (!actorId) throw new Error("ADMIN_NOT_FOUND");
    const actor = await this.users.findById(actorId);
    if (!actor || !actor.active) throw new Error("ADMIN_NOT_FOUND");
    return actor;
  }

  private async requireTarget(id: string): Promise<AdminUser> {
    const target = await this.users.findById(id.trim());
    if (!target) throw new Error("ADMIN_NOT_FOUND");
    return target;
  }
}
