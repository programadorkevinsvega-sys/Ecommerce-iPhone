import { describe, expect, it } from "vitest";
import { RequireAdmin } from "./RequireAdmin";

describe("RequireAdmin", () => {
  it("authorizes from effective permissions", async () => {
    const requireAdmin = new RequireAdmin({
      async execute() {
        return {
          id: "admin-1",
          email: "admin@example.com",
          role: "SALES",
          firstName: "Admin",
          lastName: "Test",
          permissions: ["orders:read"],
        };
      },
    });
    await expect(requireAdmin.execute("token", "orders:read")).resolves.toMatchObject({ id: "admin-1" });
  });

  it("rejects permissions outside the effective set", async () => {
    const requireAdmin = new RequireAdmin({
      async execute() {
        return {
          id: "admin-1",
          email: "admin@example.com",
          role: "SALES",
          firstName: "Admin",
          lastName: "Test",
          permissions: ["orders:read"],
        };
      },
    });
    await expect(requireAdmin.execute("token", "inventory:write")).rejects.toThrow("FORBIDDEN");
  });

  it("accepts a permission added by an explicit override", async () => {
    const requireAdmin = new RequireAdmin({
      async execute() {
        return {
          id: "admin-1",
          email: "admin@example.com",
          role: "SALES",
          firstName: "Admin",
          lastName: "Test",
          permissions: ["orders:read", "inventory:read"],
        };
      },
    });
    await expect(requireAdmin.execute("token", "inventory:read")).resolves.toMatchObject({ id: "admin-1" });
  });

  it("rejects a permission removed by an explicit deny", async () => {
    const requireAdmin = new RequireAdmin({
      async execute() {
        return {
          id: "admin-1",
          email: "admin@example.com",
          role: "ADMIN",
          firstName: "Admin",
          lastName: "Test",
          permissions: ["orders:read"],
        };
      },
    });
    await expect(requireAdmin.execute("token", "products:read")).rejects.toThrow("FORBIDDEN");
  });
});
