import { describe, expect, it } from "vitest";
import { hashPassword, hasPermission, PERMISSIONS, verifyPassword } from "./AdminSecurity";

describe("AdminSecurity", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-77!");
    expect(hash).toMatch(/^pbkdf2-sha256\$150000\$/);
    expect(hash).not.toContain("Correct-Horse");
    expect(await verifyPassword("Correct-Horse-Battery-77!", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("enforces role permissions", () => {
    expect(hasPermission("SUPER_ADMIN", PERMISSIONS.adminsManage)).toBe(true);
    expect(hasPermission("FINANCE", PERMISSIONS.refundsCreate)).toBe(true);
    expect(hasPermission("TECHNICIAN", PERMISSIONS.productsWrite)).toBe(false);
    expect(hasPermission("SUPPORT", PERMISSIONS.ordersWrite)).toBe(false);
  });
});
