import { describe, expect, it, vi } from "vitest";
import { CreateAdminSession } from "./CreateAdminSession";
import { LogoutAdmin } from "./LogoutAdmin";

describe("admin session lifecycle", () => {
  it("creates a session with a hashed token and rejects expired sessions", async () => {
    const sessions = { create: vi.fn().mockResolvedValue("session-1") };
    const hash = vi.fn(async (value: string) => `hash:${value}`);
    const service = new CreateAdminSession(sessions, hash, () => new Date("2026-01-01T00:00:00.000Z"));
    await expect(service.execute("admin-1", "raw-token", new Date("2026-01-01T01:00:00.000Z"), "ip", "ua")).resolves.toBe("session-1");
    expect(sessions.create).toHaveBeenCalledWith("admin-1", "hash:raw-token", "2026-01-01T01:00:00.000Z", "ip", "ua");
    await expect(service.execute("admin-1", "raw-token", new Date("2025-12-31T23:59:00.000Z"))).rejects.toThrow("INVALID_SESSION_EXPIRY");
  });

  it("revokes the current session and audits logout", async () => {
    const sessions = {
      findByTokenHash: vi.fn().mockResolvedValue({ sessionId: "session-1", user: {} }),
      revoke: vi.fn().mockResolvedValue(undefined),
    };
    const audit = { audit: vi.fn().mockResolvedValue(undefined) };
    const service = new LogoutAdmin(sessions, audit, async (value) => `hash:${value}`);
    await service.execute("admin-1", "raw-token", "ip");
    expect(sessions.findByTokenHash).toHaveBeenCalledWith("hash:raw-token");
    expect(sessions.revoke).toHaveBeenCalledWith("session-1");
    expect(audit.audit).toHaveBeenCalledWith("admin-1", "ADMIN_LOGOUT", "admin_user", "admin-1", { ipHash: "ip" });
  });
});
