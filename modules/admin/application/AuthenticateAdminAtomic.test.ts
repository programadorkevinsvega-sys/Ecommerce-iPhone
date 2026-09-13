import { describe, expect, it, vi } from "vitest";
import { AdminUser } from "../domain/AdminUser";
import type { AdminRepository } from "./AdminRepository";
import { AuthenticateAdminAtomic } from "./AuthenticateAdminAtomic";

function user(overrides: Partial<ReturnType<AdminUser["toPrimitives"]>> = {}) {
  return AdminUser.create("admin-1", {
    email: "admin@example.com",
    passwordHash: "stored-hash",
    role: "SUPER_ADMIN",
    firstName: "Admin",
    lastName: "Principal",
    active: true,
    failedLoginCount: 0,
    ...overrides,
  });
}

function repository(existing: ReturnType<typeof user> | null): AdminRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(existing),
    findById: vi.fn().mockResolvedValue(existing),
    save: vi.fn().mockResolvedValue(undefined),
    createInitialSuperAdmin: vi.fn().mockResolvedValue(true),
    recordFailedLogin: vi.fn().mockResolvedValue({ failedLoginCount: 1, lockedUntil: undefined }),
    recordSuccessfulLogin: vi.fn().mockResolvedValue(undefined),
  };
}

function setup(existing: ReturnType<typeof user> | null) {
  const admins = repository(existing);
  const passwords = {
    hash: vi.fn().mockResolvedValue("hash"),
    verify: vi.fn().mockResolvedValue(true),
    verifyUnknownAccount: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { audit: vi.fn().mockResolvedValue(undefined) };
  const sessions = { revokeAll: vi.fn().mockResolvedValue(undefined) };
  const createSession = { execute: vi.fn().mockResolvedValue("session-id") };
  const service = new AuthenticateAdminAtomic(admins, sessions, passwords, audit, createSession, () => new Date("2026-01-01T00:00:00.000Z"));
  return { admins, passwords, audit, sessions, createSession, service };
}

describe("AuthenticateAdminAtomic", () => {
  it("authenticates an existing administrator and creates a session", async () => {
    const context = setup(user());
    const result = await context.service.execute(" ADMIN@EXAMPLE.COM ", "correct-password", "ip", "ua");
    expect(result.admin.email).toBe("admin@example.com");
    expect(context.sessions.revokeAll).toHaveBeenCalledWith("admin-1");
    expect(context.createSession.execute).toHaveBeenCalledOnce();
    expect(context.audit.audit).toHaveBeenCalledWith("admin-1", "ADMIN_LOGIN_SUCCESS", "admin_user", "admin-1", expect.any(Object));
  });

  it("rejects an incorrect password and records the failure", async () => {
    const context = setup(user());
    context.passwords.verify.mockResolvedValue(false);
    await expect(context.service.execute("admin@example.com", "wrong-password")).rejects.toThrow("INVALID_CREDENTIALS");
    expect(context.admins.recordFailedLogin).toHaveBeenCalledWith("admin-1", expect.any(Date), 5, 15);
    expect(context.audit.audit).toHaveBeenCalledWith("admin-1", "ADMIN_LOGIN_FAILED", "admin_user", "admin-1", expect.any(Object));
  });

  it("uses the unknown-account verifier and NULL audit identity for an unknown email", async () => {
    const context = setup(null);
    await expect(context.service.execute("missing@example.com", "wrong-password")).rejects.toThrow("INVALID_CREDENTIALS");
    expect(context.passwords.verifyUnknownAccount).toHaveBeenCalledWith("wrong-password");
    expect(context.audit.audit).toHaveBeenCalledWith(null, "ADMIN_LOGIN_FAILED", "admin_user", null, expect.any(Object));
  });

  it("records a blocked login without creating a session", async () => {
    const context = setup(user({ lockedUntil: "2026-01-01T00:15:00.000Z" }));
    await expect(context.service.execute("admin@example.com", "password")).rejects.toThrow("ACCOUNT_LOCKED");
    expect(context.audit.audit).toHaveBeenCalledWith("admin-1", "ADMIN_LOGIN_BLOCKED", "admin_user", "admin-1", expect.any(Object));
    expect(context.createSession.execute).not.toHaveBeenCalled();
  });
});
