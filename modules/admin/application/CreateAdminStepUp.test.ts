import { describe, expect, it, vi } from "vitest";
import { AdminUser } from "../domain/AdminUser";
import type { AdminRepository } from "./AdminRepository";
import { CreateAdminStepUp } from "./CreateAdminStepUp";

function makeAdmin() {
  return AdminUser.create("admin-1", {
    email: "admin@example.com",
    passwordHash: "stored-password-hash",
    role: "SUPER_ADMIN",
    firstName: "Admin",
    lastName: "Principal",
    active: true,
    failedLoginCount: 0,
  });
}

function setup(passwordValid = true) {
  const admin = makeAdmin();
  const admins: AdminRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(admin),
    save: vi.fn(),
    createInitialSuperAdmin: vi.fn(),
    recordFailedLogin: vi.fn().mockResolvedValue({ failedLoginCount: 1, lockedUntil: undefined }),
    recordSuccessfulLogin: vi.fn().mockResolvedValue(undefined),
  };
  const passwords = {
    hash: vi.fn(),
    verify: vi.fn().mockResolvedValue(passwordValid),
    verifyUnknownAccount: vi.fn(),
  };
  const grants = { create: vi.fn().mockResolvedValue(undefined), hasValid: vi.fn() };
  const audit = { audit: vi.fn().mockResolvedValue(undefined) };
  const service = new CreateAdminStepUp(
    admins,
    passwords,
    grants,
    audit,
    async (value) => "hash:" + value,
    () => new Date("2026-10-31T12:00:00.000Z"),
    () => "step-up-token",
  );
  return { service, admins, passwords, grants, audit };
}

describe("CreateAdminStepUp", () => {
  it("creates a five-minute, scope-bound proof tied to the current session hash", async () => {
    const context = setup();
    const result = await context.service.execute({
      adminUserId: "admin-1",
      sessionToken: "active-session-token",
      password: "correct-admin-password",
      scope: "payments:refund",
      ipHash: "ip-hash",
    });

    expect(result.token).toBe("step-up-token");
    expect(result.expiresAt.toISOString()).toBe("2026-10-31T12:05:00.000Z");
    expect(context.grants.create).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      sessionTokenHash: "hash:active-session-token",
      tokenHash: "hash:step-up-token",
      scope: "payments:refund",
      expiresAt: "2026-10-31T12:05:00.000Z",
    });
    expect(context.audit.audit).toHaveBeenCalledWith(
      "admin-1",
      "ADMIN_STEP_UP_GRANTED",
      "admin_user",
      "admin-1",
      expect.objectContaining({ scope: "payments:refund" }),
    );
  });

  it("rejects a wrong password and records a persistent failure", async () => {
    const context = setup(false);
    await expect(
      context.service.execute({
        adminUserId: "admin-1",
        sessionToken: "active-session-token",
        password: "wrong-password",
        scope: "settings:write",
      }),
    ).rejects.toThrow("INVALID_CREDENTIALS");
    expect(context.admins.recordFailedLogin).toHaveBeenCalledWith(
      "admin-1",
      new Date("2026-10-31T12:00:00.000Z"),
      5,
      15,
    );
    expect(context.grants.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid scope without issuing a grant", async () => {
    const context = setup();
    await expect(
      context.service.execute({
        adminUserId: "admin-1",
        sessionToken: "active-session-token",
        password: "correct-admin-password",
        scope: "not-a-real-scope" as never,
      }),
    ).rejects.toThrow("INVALID_STEP_UP_SCOPE");
    expect(context.grants.create).not.toHaveBeenCalled();
  });

  it("does not issue proof for an account whose session user is inactive or missing", async () => {
    const context = setup();
    (context.admins.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      context.service.execute({
        adminUserId: "admin-1",
        sessionToken: "active-session-token",
        password: "correct-admin-password",
        scope: "payments:void",
      }),
    ).rejects.toThrow("UNAUTHORIZED");
    expect(context.passwords.verify).not.toHaveBeenCalled();
  });
});
