import { describe, expect, it, vi } from "vitest";
import { TechnicianUser } from "../domain/TechnicianUser";
import type { TechnicianPasswordHasher } from "./TechnicianPasswordHasher";
import type { TechnicianRepository } from "./TechnicianRepository";
import type { TechnicianSessionRepository } from "./TechnicianSessionRepository";
import { TechnicianManagement } from "./TechnicianManagement";

function setup() {
  const current = TechnicianUser.create("tech-1", {
    email: "tech@example.com",
    passwordHash: "stored-hash",
    firstName: "Ana",
    lastName: "Técnico",
    phone: "+57 300 000 0000",
    active: true,
    failedLoginCount: 0,
  });

  const users = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(current),
    list: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    audit: vi.fn().mockResolvedValue(undefined),
    recordFailedLogin: vi.fn(),
    recordSuccessfulLogin: vi.fn(),
  } as unknown as TechnicianRepository;

  const passwords: TechnicianPasswordHasher = {
    hash: vi.fn().mockResolvedValue("new-hash"),
    verify: vi.fn(),
    verifyUnknownAccount: vi.fn(),
  };

  const sessions = {
    create: vi.fn(),
    findByTokenHash: vi.fn(),
    revoke: vi.fn(),
    revokeAll: vi.fn().mockResolvedValue(undefined),
  } as unknown as TechnicianSessionRepository;

  return { current, users, sessions, management: new TechnicianManagement(users, passwords, sessions) };
}

describe("TechnicianManagement profile", () => {
  it("allows a technician to clear the optional phone number", async () => {
    const context = setup();

    const result = await context.management.updateProfile("tech-1", {
      firstName: "Ana",
      lastName: "Técnico",
      phone: "",
    });

    const saved = vi.mocked(context.users.save).mock.calls[0]?.[0];
    expect(saved?.toPrimitives().phone).toBeUndefined();
    expect(result.phone).toBeNull();
  });
});
