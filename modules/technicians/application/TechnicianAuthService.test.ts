import { describe, expect, it, vi } from "vitest";
import { TechnicianUser } from "../domain/TechnicianUser";
import type { TechnicianPasswordHasher } from "./TechnicianPasswordHasher";
import type { TechnicianRepository } from "./TechnicianRepository";
import type { TechnicianSessionRepository } from "./TechnicianSessionRepository";
import { TechnicianAuthService } from "./TechnicianAuthService";

function user(overrides: Partial<ReturnType<TechnicianUser["toPrimitives"]>> = {}) {
  return TechnicianUser.create("tech-1", {
    email: "tech@example.com",
    passwordHash: "stored-hash",
    firstName: "Ana",
    lastName: "Técnico",
    active: true,
    failedLoginCount: 0,
    ...overrides,
  });
}

function setup(existing: ReturnType<typeof user> | null) {
  const users = {
    findByEmail: vi.fn().mockResolvedValue(existing),
    findById: vi.fn().mockResolvedValue(existing),
    list: vi.fn().mockResolvedValue(existing ? [existing] : []),
    save: vi.fn().mockResolvedValue(undefined),
    recordFailedLogin: vi.fn().mockResolvedValue({ failedLoginCount: 1 }),
    recordSuccessfulLogin: vi.fn().mockResolvedValue(undefined),
    audit: vi.fn().mockResolvedValue(undefined),
  } as unknown as TechnicianRepository;

  const sessions = {
    create: vi.fn().mockResolvedValue("session-1"),
    findByTokenHash: vi.fn().mockResolvedValue(null),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeAll: vi.fn().mockResolvedValue(undefined),
  } as unknown as TechnicianSessionRepository;

  const passwords: TechnicianPasswordHasher = {
    hash: vi.fn().mockResolvedValue("hash"),
    verify: vi.fn().mockResolvedValue(true),
    verifyUnknownAccount: vi.fn().mockResolvedValue(undefined),
  };

  const service = new TechnicianAuthService(
    users,
    sessions,
    passwords,
    () => new Date("2026-09-20T00:00:00.000Z"),
  );

  return { users, sessions, passwords, service };
}

describe("TechnicianAuthService", () => {
  it("creates an independent technician session", async () => {
    const context = setup(user());
    const result = await context.service.authenticate(" TECH@EXAMPLE.COM ", "password", "ip", "ua");

    expect(result.principal).toMatchObject({ id: "tech-1", email: "tech@example.com" });
    expect(context.sessions.revokeAll).toHaveBeenCalledWith("tech-1");
    expect(context.sessions.create).toHaveBeenCalledOnce();
    expect(context.users.audit).toHaveBeenCalledWith(
      "tech-1",
      "LOGIN_SUCCEEDED",
      "technician_user",
      "tech-1",
      {},
      "ip",
    );
  });

  it("rejects an invalid password and records the failure", async () => {
    const context = setup(user());
    vi.mocked(context.passwords.verify).mockResolvedValue(false);

    await expect(context.service.authenticate("tech@example.com", "wrong")).rejects.toThrow("INVALID_CREDENTIALS");
    expect(context.users.recordFailedLogin).toHaveBeenCalledWith(
      "tech-1",
      expect.any(Date),
      5,
      15,
    );
    expect(context.sessions.create).not.toHaveBeenCalled();
  });

  it("does not reveal whether an account exists", async () => {
    const context = setup(null);

    await expect(context.service.authenticate("missing@example.com", "wrong")).rejects.toThrow("INVALID_CREDENTIALS");
    expect(context.passwords.verifyUnknownAccount).toHaveBeenCalledWith("wrong");
    expect(context.users.audit).toHaveBeenCalledWith(
      null,
      "LOGIN_FAILED",
      "technician_user",
      undefined,
      expect.any(Object),
      undefined,
    );
  });

  it("blocks inactive technicians", async () => {
    const context = setup(user({ active: false }));

    await expect(context.service.authenticate("tech@example.com", "password")).rejects.toThrow("ACCOUNT_DISABLED");
    expect(context.sessions.create).not.toHaveBeenCalled();
  });
});
