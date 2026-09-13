import { describe, expect, it, vi } from "vitest";
import { AdminUser } from "../domain/AdminUser";
import type { AdminRepository } from "./AdminRepository";
import { BootstrapAdmin } from "./BootstrapAdmin";

function repository(): AdminRepository & { users: AdminUser[] } {
  const result = {
    users: [] as AdminUser[],
    findByEmail: vi.fn(async (email: string) => result.users.find((candidate) => candidate.toPrimitives().email === email) ?? null),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    createInitialSuperAdmin: vi.fn(async (candidate: AdminUser) => {
      if (result.users.some((current) => current.active && current.role === "SUPER_ADMIN")) return false;
      if (result.users.some((current) => current.toPrimitives().email === candidate.toPrimitives().email)) return false;
      result.users.push(candidate);
      return true;
    }),
    recordFailedLogin: vi.fn(),
    recordSuccessfulLogin: vi.fn(),
  } satisfies AdminRepository & { users: AdminUser[] };
  return result;
}

function setup() {
  const admins = repository();
  const passwords = { hash: vi.fn(async (value: string) => `pbkdf2-sha256$100000$${value.length}`), verify: vi.fn(), verifyUnknownAccount: vi.fn() };
  const audit = { audit: vi.fn().mockResolvedValue(undefined) };
  const service = new BootstrapAdmin(admins, passwords, audit);
  return { admins, passwords, audit, service };
}

describe("BootstrapAdmin", () => {
  it("rejects an invalid token without hashing or writing", async () => {
    const context = setup();
    await expect(context.service.execute({ email: "admin@example.com", password: "long-password" }, "wrong", "expected")).rejects.toThrow("NOT_FOUND");
    expect(context.passwords.hash).not.toHaveBeenCalled();
    expect(context.admins.users).toHaveLength(0);
  });

  it("rejects missing configuration", async () => {
    const context = setup();
    await expect(context.service.execute({ email: "", password: "" }, "token", "token")).rejects.toThrow("INVALID_ADMIN_DATA");
  });

  it("rejects a bootstrap password outside the hasher policy", async () => {
    const context = setup();
    await expect(context.service.execute({ email: "admin@example.com", password: "short" }, "token", "token")).rejects.toThrow("INVALID_ADMIN_PASSWORD");
    expect(context.passwords.hash).not.toHaveBeenCalled();
  });

  it("creates a SUPER_ADMIN with only the generated hash", async () => {
    const context = setup();
    const id = await context.service.execute({ email: " ADMIN@EXAMPLE.COM ", password: "plain-secret" }, "token", "token");
    expect(id).toBe(context.admins.users[0]?.getId());
    expect(context.admins.users[0]?.toPrimitives()).toMatchObject({ email: "admin@example.com", role: "SUPER_ADMIN", passwordHash: "pbkdf2-sha256$100000$12" });
    expect(context.admins.users[0]?.toPrimitives().passwordHash).not.toContain("plain-secret");
    expect(context.audit.audit).toHaveBeenCalledOnce();
  });

  it("blocks repeated and concurrent bootstrap attempts", async () => {
    const context = setup();
    await context.service.execute({ email: "admin@example.com", password: "plain-secret" }, "token", "token");
    await expect(context.service.execute({ email: "admin@example.com", password: "plain-secret" }, "token", "token")).rejects.toThrow("ADMIN_ALREADY_EXISTS");

    const second = setup();
    const results = await Promise.allSettled([
      second.service.execute({ email: "one@example.com", password: "plain-secret" }, "token", "token"),
      second.service.execute({ email: "two@example.com", password: "plain-secret" }, "token", "token"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(second.admins.users).toHaveLength(1);
  });
});
